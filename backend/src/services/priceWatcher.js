const db = require('../db');
const { createTicker } = require('./kite');
const { sendPriceAlert } = require('./notify');

// Tracks which watchlist rows are currently in a "breached" state so we send
// exactly one notification per crossing, not one per tick while it stays past
// the limit. Resets once the price moves back to the safe side.
const breachedIds = new Set();

let ticker = null;

function isBreached(row, price) {
  return row.direction === 'below' ? price < row.limit_price : price > row.limit_price;
}

async function handleTick(tick) {
  const rows = db
    .prepare('SELECT * FROM watchlist WHERE instrument_token = ?')
    .all(tick.instrument_token);

  for (const row of rows) {
    const price = tick.last_price;
    const breached = isBreached(row, price);

    if (breached && !breachedIds.has(row.id)) {
      breachedIds.add(row.id);
      const device = db
        .prepare('SELECT device_token FROM devices WHERE device_token = ?')
        .get(row.device_token);
      if (device) {
        try {
          await sendPriceAlert(device.device_token, {
            tradingsymbol: row.tradingsymbol,
            exchange: row.exchange,
            price,
            limitPrice: row.limit_price,
            direction: row.direction,
          });
          db.prepare('UPDATE watchlist SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
        } catch (err) {
          console.error(`Failed to send alert for watchlist row ${row.id}:`, err.message);
        }
      }
    } else if (!breached && breachedIds.has(row.id)) {
      breachedIds.delete(row.id);
    }
  }
}

function resubscribe() {
  if (!ticker) return;
  const tokens = db.prepare('SELECT DISTINCT instrument_token FROM watchlist').all().map((r) => r.instrument_token);
  if (tokens.length > 0) {
    ticker.subscribe(tokens);
    ticker.setMode(ticker.modeLTP, tokens);
  }
}

function start() {
  ticker = createTicker();

  ticker.connect();
  ticker.on('connect', resubscribe);
  ticker.on('reconnect', resubscribe);
  ticker.on('ticks', (ticks) => {
    ticks.forEach((tick) => handleTick(tick).catch((e) => console.error(e)));
  });
  ticker.on('error', (err) => console.error('KiteTicker error:', err));
  ticker.on('close', () => console.warn('KiteTicker connection closed'));

  return ticker;
}

// Call this whenever the watchlist changes (add/remove) so the ticker
// subscribes/unsubscribes to the right set of instruments.
function onWatchlistChanged() {
  resubscribe();
}

module.exports = { start, onWatchlistChanged };

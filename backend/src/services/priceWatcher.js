const db = require('../db');
const yahooFinance = require('./yahooFinance');
const { sendPriceAlert } = require('./notify');

// Polling interval. Yahoo Finance data for Indian stocks is already delayed
// ~15 minutes, so polling faster than this doesn't buy real "instant" alerts
// — it just adds load. Kept short anyway so alerts fire as soon as the
// delayed price updates.
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000);

// Tracks which watchlist rows are currently in a "breached" state so we send
// exactly one notification per crossing, not one per poll while it stays
// past the limit. Resets once the price moves back to the safe side.
const breachedIds = new Set();

let timer = null;

function isBreached(row, price) {
  return row.direction === 'below' ? price < row.limit_price : price > row.limit_price;
}

async function pollOnce() {
  const rows = db.prepare('SELECT * FROM watchlist').all();
  console.log('[poll] watchlist rows:', rows.length, rows.map(r => r.instrument_token));
  if (rows.length === 0) return;

  const symbols = [...new Set(rows.map((r) => r.instrument_token))];
  let prices;
  try {
    prices = await yahooFinance.getQuotes(symbols);
  } catch (err) {
    console.error('Price poll failed:', err.message);
    return;
  }

  for (const row of rows) {
    const price = prices[row.instrument_token];
    if (price == null) continue;

    const breached = isBreached(row, price);

    if (breached && !breachedIds.has(row.id)) {
      breachedIds.add(row.id);
      const device = db.prepare('SELECT device_token FROM devices WHERE device_token = ?').get(row.device_token);
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

function start() {
  if (timer) return;
  pollOnce().catch((e) => console.error(e));
  timer = setInterval(() => pollOnce().catch((e) => console.error(e)), POLL_INTERVAL_MS);
}

// No-op kept so route handlers that used to trigger a WebSocket
// resubscribe can call this unconditionally; polling just picks up
// watchlist changes on its next cycle automatically.
function onWatchlistChanged() {}

module.exports = { start, onWatchlistChanged };

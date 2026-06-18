const { KiteConnect, KiteTicker } = require('kiteconnect');

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;

const kc = new KiteConnect({ api_key: apiKey });

let instrumentsCache = [];
let instrumentsCachedAt = 0;
const INSTRUMENTS_TTL_MS = 24 * 60 * 60 * 1000; // refresh once a day

// Kite Connect's login flow needs one Zerodha account to act as the data
// source for everyone using the app, so we keep a single shared access token
// rather than one per device.
let sharedAccessToken = null;

function getLoginUrl() {
  return kc.getLoginURL();
}

async function exchangeRequestToken(requestToken) {
  const session = await kc.generateSession(requestToken, apiSecret);
  sharedAccessToken = session.access_token;
  kc.setAccessToken(sharedAccessToken);
  return session;
}

function isAuthenticated() {
  return !!sharedAccessToken;
}

async function getInstruments({ exchange } = {}) {
  const now = Date.now();
  if (now - instrumentsCachedAt > INSTRUMENTS_TTL_MS || instrumentsCache.length === 0) {
    instrumentsCache = await kc.getInstruments(['NSE', 'BSE']);
    instrumentsCachedAt = now;
  }
  if (exchange) {
    return instrumentsCache.filter((i) => i.exchange === exchange);
  }
  return instrumentsCache;
}

async function searchInstruments(query, limit = 30) {
  const list = await getInstruments();
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return list
    .filter(
      (i) =>
        i.segment === (i.exchange === 'NSE' ? 'NSE' : 'BSE') &&
        (i.tradingsymbol.includes(q) || (i.name || '').toUpperCase().includes(q))
    )
    .slice(0, limit)
    .map((i) => ({
      instrument_token: i.instrument_token,
      tradingsymbol: i.tradingsymbol,
      name: i.name,
      exchange: i.exchange,
    }));
}

function createTicker() {
  if (!sharedAccessToken) {
    throw new Error('Kite session not authenticated yet. Visit /auth/login first.');
  }
  return new KiteTicker({ api_key: apiKey, access_token: sharedAccessToken });
}

module.exports = {
  kc,
  getLoginUrl,
  exchangeRequestToken,
  isAuthenticated,
  getInstruments,
  searchInstruments,
  createTicker,
};

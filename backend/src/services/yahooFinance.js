// Free, unofficial Yahoo Finance endpoints. No API key needed, but no
// guarantees either: Yahoo can change or rate-limit these at any time, and
// Indian market quotes through this route are typically delayed ~15 minutes.
// This is meant as a free trial source, not the production price feed.

const SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

// Yahoo represents NSE symbols as "<SYMBOL>.NS" and BSE as "<SYMBOL>.BO".
function toExchange(yahooExchange) {
  if (yahooExchange === 'NSI') return 'NSE';
  if (yahooExchange === 'BSE') return 'BSE';
  return yahooExchange;
}

async function searchInstruments(query, limit = 30) {
  const q = query.trim();
  if (!q) return [];

  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&quotesCount=${limit}&newsCount=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo search failed: ${res.status}`);
  const data = await res.json();

  return (data.quotes || [])
    .filter((item) => item.symbol && (item.symbol.endsWith('.NS') || item.symbol.endsWith('.BO')))
    .map((item) => ({
      instrument_token: item.symbol,
      tradingsymbol: item.symbol.replace(/\.(NS|BO)$/, ''),
      name: item.longname || item.shortname,
      exchange: item.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
    }));
}

// Returns a map of { "RELIANCE.NS": price, ... }
async function getQuotes(symbols) {
  if (symbols.length === 0) return {};

  const url = `${QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo quote fetch failed: ${res.status}`);
  const data = await res.json();

  const prices = {};
  for (const result of data.quoteResponse?.result || []) {
    if (typeof result.regularMarketPrice === 'number') {
      prices[result.symbol] = result.regularMarketPrice;
    }
  }
  return prices;
}

module.exports = { searchInstruments, getQuotes };

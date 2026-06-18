const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    device_token TEXT PRIMARY KEY,
    kite_access_token TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_token TEXT NOT NULL,
    instrument_token INTEGER NOT NULL,
    tradingsymbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    limit_price REAL NOT NULL,
    direction TEXT NOT NULL DEFAULT 'below', -- 'below' or 'above'
    last_triggered_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_token) REFERENCES devices(device_token)
  );
`);

module.exports = db;

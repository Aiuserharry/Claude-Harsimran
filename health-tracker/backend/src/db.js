const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_token TEXT NOT NULL,
    log_date TEXT NOT NULL, -- YYYY-MM-DD, in the device's local timezone
    description TEXT NOT NULL,
    calories INTEGER,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    source TEXT NOT NULL DEFAULT 'text', -- 'text' | 'voice' | 'photo'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_food_logs_device_date
    ON food_logs (device_token, log_date);

  CREATE TABLE IF NOT EXISTS steps (
    device_token TEXT NOT NULL,
    log_date TEXT NOT NULL,
    step_count INTEGER NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_token, log_date)
  );
`);

module.exports = db;

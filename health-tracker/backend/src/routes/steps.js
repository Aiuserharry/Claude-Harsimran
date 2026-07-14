const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /steps/sync  { device_token, log_date, step_count }
// Called periodically by the Android app after reading today's step count
// from Health Connect, so the total is available even if the app is closed.
router.post('/sync', (req, res) => {
  const { device_token, log_date, step_count } = req.body;
  if (!device_token || !log_date || step_count == null) {
    return res.status(400).json({ error: 'device_token, log_date and step_count are required' });
  }
  db.prepare(
    `INSERT INTO steps (device_token, log_date, step_count, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(device_token, log_date) DO UPDATE SET
       step_count = excluded.step_count,
       updated_at = CURRENT_TIMESTAMP`
  ).run(device_token, log_date, step_count);
  res.json({ ok: true });
});

// GET /steps?device_token=xxx&date=YYYY-MM-DD
router.get('/', (req, res) => {
  const { device_token, date } = req.query;
  if (!device_token || !date) {
    return res.status(400).json({ error: 'device_token and date are required' });
  }
  const row = db.prepare('SELECT * FROM steps WHERE device_token = ? AND log_date = ?').get(device_token, date);
  res.json({ step_count: row?.step_count ?? 0, updated_at: row?.updated_at ?? null });
});

module.exports = router;

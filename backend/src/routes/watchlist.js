const express = require('express');
const db = require('../db');
const priceWatcher = require('../services/priceWatcher');

const router = express.Router();

// Registers/updates the device so we know which device_token to push
// notifications to. Called once when the app starts up.
router.post('/devices', (req, res) => {
  const { device_token } = req.body;
  if (!device_token) return res.status(400).json({ error: 'device_token is required' });
  db.prepare(
    'INSERT INTO devices (device_token) VALUES (?) ON CONFLICT(device_token) DO NOTHING'
  ).run(device_token);
  res.json({ ok: true });
});

// GET /watchlist?device_token=xxx
router.get('/', (req, res) => {
  const { device_token } = req.query;
  if (!device_token) return res.status(400).json({ error: 'device_token is required' });
  const rows = db.prepare('SELECT * FROM watchlist WHERE device_token = ? ORDER BY created_at DESC').all(device_token);
  res.json(rows);
});

// POST /watchlist  { device_token, instrument_token, tradingsymbol, exchange, limit_price, direction }
router.post('/', (req, res) => {
  const { device_token, instrument_token, tradingsymbol, exchange, limit_price, direction } = req.body;
  if (!device_token || !instrument_token || !tradingsymbol || !exchange || limit_price == null) {
    return res.status(400).json({ error: 'device_token, instrument_token, tradingsymbol, exchange and limit_price are required' });
  }
  const result = db
    .prepare(
      `INSERT INTO watchlist (device_token, instrument_token, tradingsymbol, exchange, limit_price, direction)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(device_token, instrument_token, tradingsymbol, exchange, limit_price, direction === 'above' ? 'above' : 'below');

  priceWatcher.onWatchlistChanged();
  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /watchlist/:id  { limit_price, direction }
router.patch('/:id', (req, res) => {
  const { limit_price, direction } = req.body;
  const existing = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE watchlist SET limit_price = ?, direction = ? WHERE id = ?').run(
    limit_price ?? existing.limit_price,
    direction === 'above' ? 'above' : direction === 'below' ? 'below' : existing.direction,
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE /watchlist/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
  priceWatcher.onWatchlistChanged();
  res.json({ ok: true });
});

module.exports = router;

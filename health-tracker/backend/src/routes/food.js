const express = require('express');
const multer = require('multer');
const db = require('../db');
const { estimateFromText, estimateFromPhoto } = require('../services/foodAnalyzer');

const router = express.Router();
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });

function insertLog({ device_token, log_date, source, estimate }) {
  const result = db
    .prepare(
      `INSERT INTO food_logs (device_token, log_date, description, calories, protein_g, carbs_g, fat_g, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      device_token,
      log_date,
      estimate.description,
      estimate.calories,
      estimate.protein_g,
      estimate.carbs_g,
      estimate.fat_g,
      source
    );
  return db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid);
}

// POST /food/log/text  { device_token, log_date, description, source: 'text' | 'voice' }
router.post('/log/text', async (req, res) => {
  const { device_token, log_date, description, source } = req.body;
  if (!device_token || !log_date || !description) {
    return res.status(400).json({ error: 'device_token, log_date and description are required' });
  }
  try {
    const estimate = await estimateFromText(description);
    const entry = insertLog({
      device_token,
      log_date,
      source: source === 'voice' ? 'voice' : 'text',
      estimate,
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// POST /food/log/photo  multipart: device_token, log_date, note?, image (file)
router.post('/log/photo', upload.single('image'), async (req, res) => {
  const { device_token, log_date, note } = req.body;
  if (!device_token || !log_date || !req.file) {
    return res.status(400).json({ error: 'device_token, log_date and image are required' });
  }
  try {
    const estimate = await estimateFromPhoto(req.file.buffer, req.file.mimetype, note);
    const entry = insertLog({ device_token, log_date, source: 'photo', estimate });
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// GET /food/log?device_token=xxx&date=YYYY-MM-DD
router.get('/log', (req, res) => {
  const { device_token, date } = req.query;
  if (!device_token || !date) {
    return res.status(400).json({ error: 'device_token and date are required' });
  }
  const entries = db
    .prepare('SELECT * FROM food_logs WHERE device_token = ? AND log_date = ? ORDER BY created_at DESC')
    .all(device_token, date);
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  res.json({ entries, totals });
});

// DELETE /food/log/:id
router.delete('/log/:id', (req, res) => {
  db.prepare('DELETE FROM food_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

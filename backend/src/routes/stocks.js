const express = require('express');
const kite = require('../services/kite');

const router = express.Router();

// GET /stocks/search?q=reliance
router.get('/search', async (req, res) => {
  try {
    const results = await kite.searchInstruments(req.query.q || '');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

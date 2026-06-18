const express = require('express');
const yahooFinance = require('../services/yahooFinance');

const router = express.Router();

// GET /stocks/search?q=reliance
router.get('/search', async (req, res) => {
  try {
    const results = await yahooFinance.searchInstruments(req.query.q || '');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

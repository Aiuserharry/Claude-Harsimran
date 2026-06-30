const express = require('express');
const yahooFinance = require('../services/yahooFinance');

const router = express.Router();

// GET /stocks/search?q=reliance
router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  console.log(`[search] query="${q}"`);
  try {
    const results = await yahooFinance.searchInstruments(q);
    console.log(`[search] results count=${results.length}`);
    res.json(results);
  } catch (err) {
    console.error(`[search] error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

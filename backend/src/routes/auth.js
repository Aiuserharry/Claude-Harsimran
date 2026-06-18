const express = require('express');
const kite = require('../services/kite');
const priceWatcher = require('../services/priceWatcher');

const router = express.Router();

// One-time setup: open this URL in a browser and log in with the Zerodha
// account that should act as the live price source for the app.
router.get('/login', (req, res) => {
  res.redirect(kite.getLoginUrl());
});

// Zerodha redirects here after login with a request_token.
router.get('/callback', async (req, res) => {
  try {
    const { request_token } = req.query;
    if (!request_token) {
      return res.status(400).send('Missing request_token');
    }
    await kite.exchangeRequestToken(request_token);
    priceWatcher.start();
    res.send('Zerodha login successful. The price-watching service is now running. You can close this tab.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Login failed: ' + err.message);
  }
});

router.get('/status', (req, res) => {
  res.json({ authenticated: kite.isAuthenticated() });
});

module.exports = router;

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stocks');
const watchlistRoutes = require('./routes/watchlist');
const kite = require('./services/kite');
const priceWatcher = require('./services/priceWatcher');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/stocks', stockRoutes);
app.use('/watchlist', watchlistRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Stock alert backend listening on port ${port}`);
  if (kite.isAuthenticated()) {
    priceWatcher.start();
  } else {
    console.log(`No Zerodha session yet. Visit http://localhost:${port}/auth/login to connect one.`);
  }
});

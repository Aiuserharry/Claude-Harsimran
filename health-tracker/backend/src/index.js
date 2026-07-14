require('dotenv').config();
const express = require('express');
const cors = require('cors');

const foodRoutes = require('./routes/food');
const stepsRoutes = require('./routes/steps');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/food', foodRoutes);
app.use('/steps', stepsRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4100;
app.listen(port, () => {
  console.log(`Health tracker backend listening on port ${port}`);
});

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json'
);

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

async function sendPriceAlert(deviceToken, { tradingsymbol, exchange, price, limitPrice, direction }) {
  const direction_word = direction === 'below' ? 'dropped below' : 'risen above';
  await admin.messaging().send({
    token: deviceToken,
    notification: {
      title: `${tradingsymbol} ${direction_word} your limit`,
      body: `${tradingsymbol} (${exchange}) is now ₹${price.toFixed(2)}, your limit was ₹${limitPrice.toFixed(2)}.`,
    },
    data: {
      tradingsymbol,
      exchange,
      price: String(price),
      limitPrice: String(limitPrice),
      direction,
    },
    android: {
      priority: 'high',
      notification: { channelId: 'price_alerts', sound: 'default' },
    },
  });
}

module.exports = { sendPriceAlert };

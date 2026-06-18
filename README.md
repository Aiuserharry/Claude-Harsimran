# Stock Alert

Tracks a watchlist of NSE/BSE stocks and sends an Android phone notification
the instant a stock crosses a price limit you set.

Two parts:
- `backend/` — Node.js service that streams live prices from your Zerodha
  account and sends the notifications.
- `android/` — the Android app (watchlist + search + price limits).

## 1. Backend setup

### 1a. Create a Zerodha Kite Connect app
1. Go to https://developers.kite.trade and log in with your Zerodha account.
2. Create a new app, set the redirect URL to `http://localhost:4000/auth/callback`
   (or `http://<your-server-domain>/auth/callback` once deployed).
3. Note the **API key** and **API secret**.

### 1b. Create a Firebase project (for push notifications)
1. Go to https://console.firebase.google.com and create a project.
2. Project settings → Service accounts → "Generate new private key". Save the
   downloaded JSON as `backend/firebase-service-account.json`.
3. Project settings → General → add an Android app with package name
   `com.stockalert.app`, download `google-services.json`, and place it at
   `android/app/google-services.json`.

### 1c. Run the backend
```
cd backend
cp .env.example .env   # fill in KITE_API_KEY and KITE_API_SECRET
npm install
npm start
```
Then open `http://localhost:4000/auth/login` in a browser once, log in with
your Zerodha account, and approve the app. That Zerodha login is what powers
live prices for everyone using the app — you only need to do this once (the
session is reused until it expires, after which just revisit the login URL).

## 2. Android app setup
1. Open the `android/` folder in Android Studio.
2. Make sure `android/app/google-services.json` (from step 1b) is in place.
3. In `android/app/build.gradle.kts`, update `BACKEND_BASE_URL` to point at
   wherever you're running the backend (an emulator can reach your laptop's
   backend at `http://10.0.2.2:4000/`; a real phone needs your computer's LAN
   IP or a deployed server URL, e.g. `http://192.168.1.20:4000/`).
4. Run the app on your phone (USB debugging) or an emulator.

## 3. Using the app
1. Search for a stock (e.g. "RELIANCE") and tap **Add**.
2. Enter the price limit and choose whether to be alerted when the price
   goes **below** it (e.g. to buy the dip) or **above** it (e.g. to sell).
3. Keep the backend running during market hours — that's what watches
   prices and triggers the notification the moment your limit is crossed.

## Notes on deploying for everyday use
Running the backend on your laptop only works while your laptop is on and
the app is running. For always-on alerts, deploy `backend/` to a small cloud
server (e.g. a $5/month VPS) and update `BACKEND_BASE_URL` in the Android app
to that server's address.

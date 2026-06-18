# Stock Alert

Tracks a watchlist of NSE/BSE stocks and sends an Android phone notification
when a stock crosses a price limit you set.

Two parts:
- `backend/` — Node.js service that polls prices and sends the notifications.
- `android/` — the Android app (watchlist + search + price limits).

**Current data source: free Yahoo Finance quotes (trial mode).** No broker
account or API key needed, but two things to know:
- Prices for Indian stocks via this route are typically delayed **~15 minutes**,
  not live tick-by-tick.
- It's an unofficial/free endpoint — Yahoo could change or block it without
  notice. If that happens, or once you want true real-time alerts, the fix is
  swapping `backend/src/services/yahooFinance.js` for a broker API (e.g. a
  free Upstox or Angel One developer account) — ask and I'll wire that in.

## 1. Backend setup

### 1a. Create a Firebase project (free, for push notifications)
1. Go to https://console.firebase.google.com and create a project.
2. Project settings → Service accounts → "Generate new private key". Save the
   downloaded JSON as `backend/firebase-service-account.json`.
3. Project settings → General → add an Android app with package name
   `com.stockalert.app`, download `google-services.json`, and place it at
   `android/app/google-services.json`.

### 1b. Run the backend
```
cd backend
cp .env.example .env
npm install
npm start
```
That's it — no login step needed, since there's no broker account involved
in trial mode. The backend starts polling prices immediately.

## 2. Android app setup
1. Open the `android/` folder in Android Studio.
2. Make sure `android/app/google-services.json` (from step 1a) is in place.
3. In `android/app/build.gradle.kts`, update `BACKEND_BASE_URL` to point at
   wherever you're running the backend (an emulator can reach your laptop's
   backend at `http://10.0.2.2:4000/`; a real phone needs your computer's LAN
   IP or a deployed server URL, e.g. `http://192.168.1.20:4000/`).
4. Run the app on your phone (USB debugging) or an emulator.

## 3. Using the app
1. Search for a stock (e.g. "RELIANCE") and tap **Add**.
2. Enter the price limit and choose whether to be alerted when the price
   goes **below** it (e.g. to buy the dip) or **above** it (e.g. to sell).
3. Keep the backend running — that's what checks prices and triggers the
   notification once your limit is crossed (subject to the ~15 min delay
   noted above in trial mode).

## Notes on deploying for everyday use
Running the backend on your laptop only works while your laptop is on and
the app is running. For always-on alerts, deploy `backend/` to a small cloud
server (e.g. a $5/month VPS) and update `BACKEND_BASE_URL` in the Android app
to that server's address.

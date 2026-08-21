# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Stock Alert: tracks a watchlist of NSE/BSE stocks and pushes an Android
notification when a stock crosses a user-set price limit. Two independent
projects in one repo, talking over a small HTTP API:

- `backend/` — Node.js (Express + better-sqlite3) service that polls prices
  and sends Firebase Cloud Messaging push notifications.
- `android/` — Kotlin Android app (watchlist UI, stock search, price limits).

There is no shared build system between the two; they are developed and run
independently.

## Data source constraint (important context for any pricing-related change)

Prices come from Yahoo Finance's free, unofficial, unauthenticated endpoints
(`backend/src/services/yahooFinance.js`) — no broker account or API key.
Two consequences that shape the code:
- Indian market quotes via this route are delayed ~15 minutes, not live tick
  data. `POLL_INTERVAL_MS` (default 30s, see `backend/.env.example`) is kept
  short mainly so alerts fire promptly once the delayed price *does* update,
  not because faster polling gets fresher data.
- The endpoint is unofficial and can change or be blocked by Yahoo without
  notice. If/when it needs replacing with a real broker API (e.g. Upstox,
  Angel One), `yahooFinance.js` is the only file that should need to change
  — `priceWatcher.js` and the routes consume it through `searchInstruments()`
  / `getQuotes()` and don't care about the underlying source.

## Backend (`backend/`)

Commands (run from `backend/`):
```
npm install
cp .env.example .env      # then fill in FIREBASE_SERVICE_ACCOUNT_PATH
npm start                 # node src/index.js
npm run dev                # node --watch src/index.js (auto-restart)
```
There is no test suite and no lint config in this project — don't invent
commands for either.

Required setup: a Firebase service account JSON (Firebase console → Project
settings → Service accounts) must exist at the path in
`FIREBASE_SERVICE_ACCOUNT_PATH`, or be passed inline as
`FIREBASE_SERVICE_ACCOUNT_JSON`. `notify.js` fails at require-time without
one of these — the server won't boot without valid Firebase credentials.

### Architecture

`src/index.js` wires everything: Express app → mounts `routes/stocks.js` at
`/stocks` and `routes/watchlist.js` at `/watchlist` → starts
`priceWatcher.start()` after the HTTP server is listening.

Request flow for the two route files is thin — they talk directly to
`better-sqlite3` (synchronous, no ORM) via the shared `db` singleton in
`src/db.js`, which also owns schema creation (`CREATE TABLE IF NOT EXISTS`
run at require-time, no migration framework).

The core logic lives in `services/priceWatcher.js`, which runs on its own
timer independent of any HTTP request:
1. Every `POLL_INTERVAL_MS`, reads the full `watchlist` table.
2. Batches all distinct instrument tokens into one `yahooFinance.getQuotes()`
   call.
3. For each row, checks `isBreached()` (price below/above `limit_price`
   depending on `direction`).
4. Uses the in-memory `breachedIds` Set to fire exactly one notification per
   crossing (not one per poll while still breached), clearing the id once
   price returns to the safe side. **This state is in-memory only** — it
   resets on backend restart, so a restart while a stock is still breached
   can cause a duplicate notification on the next poll.
5. Sends via `services/notify.js` (Firebase Admin SDK), and stamps
   `last_triggered_at` on success.

Two tables only: `devices` (one row per registered device/FCM token) and
`watchlist` (one row per stock+limit a device is watching, FK to `devices`).
`instrument_token` is the Yahoo symbol (e.g. `RELIANCE.NS`); `tradingsymbol`
is the human-readable ticker without the exchange suffix.

There's no auth: any `device_token` can read/write any watchlist row by
device_token alone. Don't add auth speculatively — this mirrors the app's
current no-login design (see README) and would need coordinated Android
changes.

## Android app (`android/`)

Kotlin, single-module Gradle project (`:app`), namespace
`com.stockalert.app`, minSdk 24 / target & compileSdk 33, Java/Kotlin target
17. No unit or instrumentation tests currently exist in this project.

Build/run: open `android/` in Android Studio and run normally, or from the
CLI (`android/`):
```
./gradlew assembleDebug
./gradlew installDebug
```
(No `gradlew` wrapper script is currently checked in — Android Studio
generates one on first sync, or use a local `gradle` install.)

Setup dependencies (see root `README.md` for the full walkthrough):
- `android/app/google-services.json` (from the Firebase project) must be
  present — Firebase Messaging won't initialize without it.
- `BuildConfig.BACKEND_BASE_URL` is set in `android/app/build.gradle.kts`
  (`defaultConfig.buildConfigField`), currently pointed at a deployed Render
  instance. Point it at an emulator host (`http://10.0.2.2:4000/`), LAN IP,
  or deployed server as needed — there's no runtime/settings-screen override.

### Architecture

No dependency injection framework, no ViewModel/Repository layering —
everything is deliberately flat:

- `ApiClient` (`api/ApiClient.kt`) — a lazy singleton Retrofit instance
  (Gson converter) built from `BuildConfig.BACKEND_BASE_URL`.
- `ApiService` (`api/ApiService.kt`) — the full backend surface as suspend
  functions, one method per REST endpoint in `backend/src/routes/`.
- `model/Models.kt` — plain data classes mirroring the JSON shapes the
  backend sends/expects (field names match the backend's snake_case exactly,
  e.g. `instrument_token`, `limit_price` — keep them in sync when changing
  either side).
- `MainActivity` — owns all app state and logic directly: registers the FCM
  device token with the backend on launch, drives search-as-you-type
  (`StockSearchAdapter`) and the watchlist (`WatchlistAdapter`) via two
  `RecyclerView`s, and issues all API calls through `lifecycleScope.launch`
  with try/catch → `Toast` on failure (the app's only error-handling
  pattern — follow it for new calls rather than introducing a different one).
- `AlertMessagingService` (FCM) — receives push notifications in the
  background and posts them as local Android notifications on channel
  `price_alerts` (created in `App.kt`). Also caches a rotated FCM token in
  `DeviceTokenStore` (in-memory only) in case the token changes while the
  app is backgrounded; `MainActivity` re-registers the token with the
  backend on every launch regardless, so this cache is just to avoid losing
  a token rotation between launches.

### Keeping the two sides in sync

Because there's no shared schema/codegen, when changing a backend route's
request/response shape, update both:
1. The route handler in `backend/src/routes/`.
2. The matching `ApiService` method signature and the relevant data class in
   `android/.../model/Models.kt`.

Field names are expected to match exactly (Gson/Retrofit maps by name, and
the backend reads `req.body` fields by name) — there's no explicit mapping
layer to catch a mismatch, it just fails silently as null/missing fields at
runtime.

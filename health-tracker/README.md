# Health Tracker

A personal health tracking assistant. V1 covers the core daily-use loop:

- **Food logging** — speak a description, type one, or take a photo of your
  meal. The backend sends it to Claude (vision + text) to estimate calories
  and macros, and logs it against today's date.
- **Step tracking** — reads today's step count from Health Connect (the
  on-device store that phone sensors, Google Fit, Wear OS, etc. all write
  into) and shows it alongside your calorie total.

Two parts:
- `backend/` — Node.js service: stores food/step logs, calls Claude for
  calorie estimates.
- `android/` — the Android app (today's log, camera/voice/text food entry,
  step count).

**Not in v1** (intentionally deferred): reading a photo of your calendar to
suggest meal timing, and the AI-driven UI customization/theming assistant.
Both are bigger, separate pieces of work — worth building once the core
logging loop is proven out.

## 1. Backend setup

### 1a. Get an Anthropic API key
Create one at https://console.anthropic.com — this is what powers the
calorie/macro estimates from food photos and descriptions.

### 1b. Run the backend
```
cd backend
cp .env.example .env
# edit .env and paste in your ANTHROPIC_API_KEY
npm install
npm start
```
The backend listens on port 4100 by default and stores everything in a local
`data.sqlite` file — no separate database setup needed.

## 2. Android app setup
1. Open the `android/` folder in Android Studio.
2. In `android/app/build.gradle.kts`, update `BACKEND_BASE_URL` to point at
   wherever you're running the backend (an emulator can reach your laptop's
   backend at `http://10.0.2.2:4100/`; a real phone needs your computer's
   LAN IP or a deployed server URL, e.g. `http://192.168.1.20:4100/`).
3. Make sure the **Health Connect** app is available on your test device —
   it's built into Android 14+, or installable from the Play Store on older
   versions. The app will prompt for step-read permission on first launch;
   if you skip it, steps show as "N/A" but food logging still works.
4. Run the app on your phone (USB debugging) or an emulator. Camera-based
   logging needs a real camera, so an emulator is best for voice/text entry
   only.

## 3. Using the app
1. Tap the mic icon and describe what you ate, snap a photo of your plate,
   or type a description — each gets logged with an AI-estimated calorie
   and macro breakdown.
2. Today's log and running calorie total are shown on the main screen.
3. Steps sync automatically in the background whenever the app is open.

## Notes on deploying for everyday use
Running the backend on your laptop only works while your laptop is on and
the app is running. For always-on logging, deploy `backend/` to a small
cloud server (e.g. a $5/month VPS, or Render/Railway) and update
`BACKEND_BASE_URL` in the Android app to that server's address.

## Costs to be aware of
Every photo/text/voice food log makes one call to the Claude API, so cost
scales with how often you log — a few cents a day for typical use. There's
no cost when the app is just sitting idle.

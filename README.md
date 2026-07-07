# 🚦 Kaggadasapura Crossing Predictor

A mobile-first web app that predicts when the **Kaggadasapura Railway Crossing** gate (Bengaluru) will open and close — built for commuters who are tired of guessing whether to wait or take a detour.

**Live app:** https://eshwaryapathak-pm.github.io/KagdassapuraRailwayCrossing/

> Adapted from [BxtGeek/railway-crossing-data](https://github.com/BxtGeek/railway-crossing-data) using the same technique. This crossing is on the **Bengaluru–Salem line**, flanked by **Baiyyappanahalli (BYPL)** (~2.5 km) and **Belandur Road (BLRR)** (~7.8 km).

---

## What it does

- Shows whether the crossing is currently **OPEN**, **CLOSED**, or **APPROACHING**
- Predicts the **next closure time** and **expected reopening time**
- Lists upcoming trains with direction and ETA to the crossing
- Merges back-to-back trains into a single continuous closure (no false open → close → open flicker)
- Shows a **confidence score** that reflects how fresh the data is
- Works entirely without a backend server — hosted free on GitHub Pages

---

## How it works

- A **free external scheduler** (cron-job.org) pokes the refresh workflow every **30 minutes, 8 AM–8 PM IST** via the GitHub API. (GitHub's own `schedule:` cron is unreliable, so it isn't used.) Each run makes 2 API calls (BYPL + BLRR); 24 runs/day × 2 = **48 calls/day**, under the free-tier budget of **50/day**.
- The **GitHub Action** polls the RailRadar live board for two stations (BYPL and BLRR) and commits a fresh `cache.json` to the repo
- Each refresh commit also triggers a redeploy, so the **React app** fetches `cache.json` from its **own GitHub Pages origin** (same-origin) — reliable on mobile networks (no cross-site request that Private Relay / content blockers drop)
- A **prediction engine** runs entirely in the browser and turns raw departure times into gate open/close predictions

---

## Prediction logic

This is how the app calculates when the gate will close and reopen.

### Step 1 — Find approaching trains

- Fetches the live departure board for **BYPL** (~2.5 km away) and **BLRR** (~7.8 km away)
- **Junction filter:** BYPL is a junction, so its board also lists Kolar / Bangarpet / Jolarpettai-line trains that never cross this gate. A BYPL train is kept only if it also appears on the (single-line) BLRR board or is in a small allowlist confirmed by RailRadar's `/trains/between/BYPL/BLRR` endpoint. This removes false closures. (See `scripts/parse_cache.py`.)
- Only considers trains departing within the next **20 minutes** from either station
- Cancelled trains are skipped
- If a train has a delay, the **expected departure time** is used instead of scheduled time
- Duplicate train numbers (can appear on both boards for double-tracking) are deduplicated

### Step 2 — Calculate ETA to crossing

Since RailRadar doesn't provide a train's exact position between stations, the app estimates transit time using a simple speed model:

```
Transit time (seconds) = (Distance from station to crossing ÷ 60 km/h) × 3600

ETA at crossing = Train departure time + Transit time
```

- BYPL → Crossing: 2.5 km ÷ 60 km/h = **~2.5 minutes**
- BLRR → Crossing: 7.8 km ÷ 60 km/h = **~7.8 minutes**

### Step 3 — Calculate gate close and open times

For each approaching train:

```
Gate closes = ETA at crossing − 5 minutes  (300 seconds before arrival)
Gate opens  = ETA at crossing + 2 minutes  (120 seconds after passing)
```

Example: train ETA at crossing is 10:30
- Gate closes: **10:25**
- Gate opens: **10:32**

These values (`gateCloseBeforeSeconds: 300`, `gateOpenAfterSeconds: 120`) are configurable in `src/lib/config.ts`.

### Step 4 — Merge overlapping closures

If two trains are close together, their individual gate windows may overlap. The app merges them into a single continuous closure instead of showing two separate open/close events.

```
Train A: gate closes 10:25 → opens 10:32
Train B: gate closes 10:31 → opens 10:38

Merged:  gate closes 10:25 → opens 10:38  ✓
```

Two windows are merged if the second closure starts within **60 seconds** (the buffer) of the first reopening. The buffer is configurable (`bufferSeconds: 60` in `src/lib/config.ts`).

### Step 5 — Determine crossing state

After building the merged windows, the current state is set as:

- **CLOSED** — if the current time falls inside an active gate window
- **APPROACHING** — if a train's ETA is within the 5-minute gate-close lead time but the gate isn't closed yet
- **OPEN** — no trains in any of the above windows

### Step 6 — Confidence score

The confidence score reflects how much to trust the prediction based on data age:

```
0–6 minutes old   → 95%  (fresh, no decay)
7 minutes old     → 93%
8 minutes old     → 91%
...and so on, dropping 2% per minute
Floor             → 50%  (never goes below this)
```

A muted note appears if data is more than **~45 minutes old** (a delayed refresh in-window, or the paused 8 PM–8 AM overnight window).

---

## Configuration values (src/lib/config.ts)

| Parameter | Value | Meaning |
|---|---|---|
| `gateCloseBeforeSeconds` | 300 (5 min) | How early the gate closes before a train arrives |
| `gateOpenAfterSeconds` | 120 (2 min) | How long after a train passes before gate reopens |
| `bufferSeconds` | 60 (1 min) | Gap threshold for merging consecutive closures |
| `approachingWindowMinutes` | 20 min | How far ahead to look for trains |
| `confidenceDecayStartMinutes` | 6 min | When confidence starts dropping |
| `confidenceDecayPerMinute` | 2% | How fast confidence drops per stale minute |
| `minConfidence` | 50% | Floor — confidence never goes below this |
| `AVG_SPEED_KMH` | 60 km/h | Assumed train speed between station and crossing |

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Data fetching | React Query |
| Maps | Leaflet |
| Hosting | GitHub Pages |
| Data refresh | Scheduled GitHub Actions (cron) + Python |
| PWA support | vite-plugin-pwa |

---

## Project structure

- `src/lib/prediction.ts` — the core prediction engine (pure functions, no side effects)
- `src/lib/config.ts` — crossing details and all tuning constants
- `src/lib/api.ts` — fetches `cache.json` from the app's own origin (same-origin)
- `src/components/` — all UI pieces (status card, train list, timeline, map)
- `scripts/parse_cache.py` — parses the RailRadar API response into the app's data format
- `.github/workflows/refresh-data.yml` — triggered every 30 min (8 AM–8 PM IST) by an external scheduler via the GitHub API; fetches and commits fresh data
- `.github/workflows/deploy.yml` — builds and publishes the site to GitHub Pages (on code push only)

---

## Running locally

```bash
git clone https://github.com/eshwaryapathak-PM/KagdassapuraRailwayCrossing.git
cd KagdassapuraRailwayCrossing
npm install
npm run dev
```

The app loads using the seed data in `public/data/cache.json`.

---

## Setting this up for a different crossing

See **[Deployment.md](Deployment.md)** for a step-by-step guide.

import type { CrossingConfig } from '../types'

// ── Kaggadasapura Railway Crossing ───────────────────────────────────────────
// Coordinates from Google Maps ("Kaggadasapura railway cross").
// This crossing sits on the same KJM ↔ Bellandur Road line as the reference
// project, so the same two stations are used — but here KJM is the NEARER
// station and Bellandur Road is the farther one (opposite of Kadubeesanahalli).
//
// NOTE: distanceFromStationA/B are straight-line estimates scaled to rail
// distance. Verify against the real rail track length if you want tighter ETAs;
// the gate lead/buffer settings tolerate small errors.
export const KAGGADASAPURA: CrossingConfig = {
  crossingId: 'kaggadasapura',
  name: 'Kaggadasapura Railway Crossing',
  latitude: 12.9836831,
  longitude: 77.679778,
  stationA: { code: 'KJM', name: 'Krishnarajapuram' },   // nearer station (~1.9 km)
  stationB: { code: 'BLRR', name: 'Bellandur Road' },    // farther station (~5.9 km)
  distanceFromStationA: 1.9,
  distanceFromStationB: 5.9,
  tracks: 2,
  gateCloseBeforeSeconds: 300,
  gateOpenAfterSeconds: 120,
  bufferSeconds: 60,
}

export const PREDICTION_CONFIG = {
  approachingWindowMinutes: 20,
  cacheMinutes: 7,
  refreshIntervalMinutes: 5,
  confidenceDecayStartMinutes: 6,
  confidenceDecayPerMinute: 2,
  minConfidence: 50,
}

// ── Where to fetch cache.json from ───────────────────────────────────────────
//
// PROBLEM: cache.json is updated by GitHub Actions every 5 min (committed to
// the repo), but the GitHub Pages *site* is only rebuilt when deploy.yml runs.
// Fetching from the Pages URL (BASE_URL/data/cache.json) returns whatever was
// baked into the build at deploy time — it goes stale the moment new data
// lands in the repo without a fresh deploy.
//
// SOLUTION: fetch directly from raw.githubusercontent.com, which always serves
// the latest committed file instantly — no rebuild or redeploy ever needed
// for data updates.
//
// ⚠️  IMPORTANT: set GH_USER to your GitHub username before deploying, or the
// app will not be able to load live data.

const GH_USER   = 'YOUR_GITHUB_USERNAME'          // ← change this to your GitHub username
const GH_REPO   = 'kaggadasapura-railway-crossing'
const GH_BRANCH = 'main'

export const CACHE_JSON_URL =
  `https://raw.githubusercontent.com/${GH_USER}/${GH_REPO}/${GH_BRANCH}/public/data/cache.json`

import type { CrossingConfig } from '../types'

// ── Kaggadasapura Railway Crossing ───────────────────────────────────────────
// Coordinates from Google Maps ("Kaggadasapura railway cross").
// The gate is on the Bengaluru–Salem line, which runs:
//   Baiyyappanahalli (BYPL) → Belandur Road (BLRR) → Carmelaram → …
// The crossing sits on the BYPL ↔ BLRR segment, so those are the two flanking
// stations. (Krishnarajapuram / KJM is on a different line toward Jolarpettai
// and its trains mostly do NOT cross this gate.)
//
// NOTE: RailRadar reports the BYPL↔BLRR track segment as 10.3 km. The gate sits
// ~2.5 km south of BYPL, so ~7.8 km north of BLRR. These tolerate small errors
// thanks to the gate lead/buffer settings.
export const KAGGADASAPURA: CrossingConfig = {
  crossingId: 'kaggadasapura',
  name: 'Kaggadasapura Railway Crossing',
  latitude: 12.9836831,
  longitude: 77.679778,
  stationA: { code: 'BYPL', name: 'Baiyyappanahalli' },  // nearer station (~2.5 km)
  stationB: { code: 'BLRR', name: 'Belandur Road' },     // farther station (~7.8 km)
  distanceFromStationA: 2.5,
  distanceFromStationB: 7.8,
  tracks: 2,
  gateCloseBeforeSeconds: 300,
  gateOpenAfterSeconds: 120,
  bufferSeconds: 60,
}

export const PREDICTION_CONFIG = {
  // How far ahead to surface trains. RailRadar's live board (already fetched in
  // the same 2 API calls) returns ~1 hour of departures, so widening this to 60
  // min lets us show the next two closures — even with a gap — at NO extra API
  // cost. The APPROACHING/CLOSED state still keys off gateCloseBeforeSeconds.
  approachingWindowMinutes: 60,
  cacheMinutes: 35,             // data is "fresh" within one 30-min refresh cycle
  refreshIntervalMinutes: 5,    // how often the browser re-reads the committed cache.json (free, no API call)
  confidenceDecayStartMinutes: 35,  // stay at full confidence within a normal 30-min cycle
  confidenceDecayPerMinute: 1.5,
  minConfidence: 50,
}

// ── Where to fetch cache.json from ───────────────────────────────────────────
//
// We fetch from the app's OWN origin (GitHub Pages), same-origin. This is far
// more reliable on mobile networks than a cross-site request to
// raw.githubusercontent.com, which iCloud Private Relay / content blockers /
// flaky mobile connections frequently drop (causing "Load failed").
//
// Freshness: the `refresh-data.yml` workflow commits a new cache.json every
// 30 min and, because its commit is NOT marked [skip ci], that push triggers
// `deploy.yml`, which republishes the site — so this same-origin copy is kept
// current (about a minute behind each refresh). A `?t=` cache-buster + no-store
// fetch avoids any stale service-worker/CDN copy.
//
// import.meta.env.BASE_URL === the Vite `base` ('/KagdassapuraRailwayCrossing/').

export const CACHE_JSON_URL = `${import.meta.env.BASE_URL}data/cache.json`

// Live-traffic endpoint served by the Cloudflare Worker (proxies TomTom, key
// stays a Worker secret, cached 3 min). Used by the Route (beta) tab.
export const TRAFFIC_URL = 'https://kaggadasapura-refresh.eshwaryapathak.workers.dev/traffic'

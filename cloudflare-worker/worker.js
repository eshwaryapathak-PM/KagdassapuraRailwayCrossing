// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Worker — reliable scheduler for the Kaggadasapura crossing refresh
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY: GitHub's built-in `schedule:` cron proved unreliable (fired 0 times on
// this repo). Cloudflare's cron triggers are reliable and free. This Worker
// simply calls the GitHub API to run the "Refresh crossing data" workflow on a
// schedule.
//
// SETUP (all in the Cloudflare dashboard — no CLI needed):
//   1. dash.cloudflare.com → Workers & Pages → Create → Worker →
//      replace the starter code with THIS file's contents → Deploy.
//   2. Open the Worker → Settings → Variables and Secrets → add:
//        GH_TOKEN     (Secret) = your fine-grained GitHub PAT
//                                 (Actions: Read and write on this repo)
//        TRIGGER_KEY  (Secret) = any random string (optional — enables the
//                                 manual test URL below)
//   3. Settings → Triggers → Cron Triggers → Add Cron Trigger, add BOTH:
//        30 2-13 * * *
//        0 3-14 * * *
//      (UTC. IST = UTC+5:30, so together these fire every 30 min from
//       08:00 to 19:30 IST = 24 runs/day × 2 API calls = 48/day, under 50.)
//
// TEST NOW: visit  https://<your-worker>.workers.dev/?key=<TRIGGER_KEY>
//   → responds "dispatched: 204" and a run appears in the repo's Actions tab.

const OWNER = 'eshwaryapathak-PM'
const REPO = 'KagdassapuraRailwayCrossing'
const WORKFLOW = 'refresh-data.yml'

async function dispatch(env) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GH_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': `${REPO}-cron-worker`, // GitHub API requires a User-Agent
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  )
  return res.status // 204 = success
}

// ── Live traffic (TomTom) ────────────────────────────────────────────────────
// Driving time (with live traffic) from the two approach landmarks to the gate.
// Needs a Worker secret TOMTOM_KEY (free tier). Cached 3 min so many visitors
// share one upstream call, keeping us well inside TomTom's free daily limit.
const GATE = '12.9836831,77.679778'
const ROUTES = {
  purva: { label: 'Purva Seasons', side: 'west', origin: '12.9877795,77.6668834' },
  ganga: { label: 'Sri Ganga Bhavani Temple', side: 'east', origin: '12.9887396,77.6843295' },
}

async function oneRoute(origin, env) {
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${GATE}/json` +
    `?key=${env.TOMTOM_KEY}&traffic=true&travelMode=car&routeType=fastest`
  const r = await fetch(url)
  if (!r.ok) return { error: `tomtom ${r.status}` }
  const s = ((await r.json()).routes || [])[0]?.summary
  if (!s) return { error: 'no-route' }
  return {
    sec: s.travelTimeInSeconds,
    delaySec: s.trafficDelayInSeconds ?? 0,
    freeSec: s.noTrafficTravelTimeInSeconds ?? s.travelTimeInSeconds,
    meters: s.lengthInMeters,
  }
}

async function trafficResponse(env) {
  if (!env.TOMTOM_KEY) {
    return { error: 'TOMTOM_KEY not set on the Worker' }
  }
  const [purva, ganga] = await Promise.all([
    oneRoute(ROUTES.purva.origin, env),
    oneRoute(ROUTES.ganga.origin, env),
  ])
  return {
    routes: {
      purva: { ...ROUTES.purva, ...purva },
      ganga: { ...ROUTES.ganga, ...ganga },
    },
  }
}

export default {
  // Fired automatically by the cron triggers.
  async scheduled(_event, env, _ctx) {
    const status = await dispatch(env)
    console.log('scheduled dispatch status:', status)
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // ── Live traffic endpoint (CORS-enabled, 3-min edge cache) ───────────────
    if (url.pathname === '/traffic') {
      const cache = caches.default
      // Fixed key (ignores the client's ?t= cache-buster) so all callers share
      // one cached upstream result for ~3 min.
      const cacheKey = new Request(new URL('/traffic', url.origin).toString(), { method: 'GET' })
      let hit = await cache.match(cacheKey)
      if (!hit) {
        const data = await trafficResponse(env)
        hit = new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=180',
          },
        })
        ctx.waitUntil(cache.put(cacheKey, hit.clone()))
      }
      // add CORS on every response (cached or fresh)
      const out = new Response(hit.body, hit)
      out.headers.set('Access-Control-Allow-Origin', '*')
      return out
    }

    // ── Manual refresh trigger (protected by TRIGGER_KEY) ────────────────────
    if (!env.TRIGGER_KEY || url.searchParams.get('key') !== env.TRIGGER_KEY) {
      return new Response('Kaggadasapura refresh worker — runs on schedule.', { status: 200 })
    }
    const status = await dispatch(env)
    return new Response(`dispatched: ${status}`, { status: 200 })
  },
}

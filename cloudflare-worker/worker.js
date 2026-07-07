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

export default {
  // Fired automatically by the cron triggers.
  async scheduled(_event, env, _ctx) {
    const status = await dispatch(env)
    console.log('scheduled dispatch status:', status)
  },

  // Optional manual test endpoint, protected by TRIGGER_KEY.
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!env.TRIGGER_KEY || url.searchParams.get('key') !== env.TRIGGER_KEY) {
      return new Response('Kaggadasapura refresh worker — runs on schedule.', { status: 200 })
    }
    const status = await dispatch(env)
    return new Response(`dispatched: ${status}`, { status: 200 })
  },
}

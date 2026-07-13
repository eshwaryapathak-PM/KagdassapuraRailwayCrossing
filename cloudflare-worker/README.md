# Cloudflare Worker — reliable refresh scheduler

GitHub's built-in `schedule:` cron is unreliable, so the refresh is triggered by
this tiny Cloudflare Worker instead (free plan). It calls the GitHub API on a
schedule to run the **Refresh crossing data** workflow.

## Deploy via the Cloudflare dashboard (no CLI needed)

1. **Create the Worker**
   [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** →
   **Create** → **Worker** → name it `kaggadasapura-refresh` → **Deploy** →
   **Edit code** → replace the starter code with the contents of
   [`worker.js`](worker.js) → **Deploy**.

2. **Add secrets** — Worker → **Settings → Variables and Secrets**:
   | Name | Type | Value |
   |---|---|---|
   | `GH_TOKEN` | Secret | Fine-grained GitHub PAT with **Actions: Read and write** on this repo |
   | `TRIGGER_KEY` | Secret | Any random string (enables the manual test URL) |

3. **Add the schedule** — Worker → **Settings → Triggers → Cron Triggers** →
   add **both**:
   ```
   30 2-13 * * *
   0 3-14 * * *
   ```
   (UTC. Together = every 30 min from **08:00 to 19:30 IST** = 24 runs/day ×
   2 API calls = **48/day**, under the free 50/day limit.)

4. **Test it** — visit `https://<your-worker>.workers.dev/?key=<TRIGGER_KEY>`.
   It should say `dispatched: 204`, and a new run appears in the repo's
   **Actions** tab within seconds.

## Live traffic (Route tab) — optional

The Worker also serves `GET /traffic`, which returns TomTom driving times (with
live traffic) from the two approach landmarks to the gate, cached ~2 min. To
enable it:

1. Get a free API key at **[developer.tomtom.com](https://developer.tomtom.com)**
   (free tier — no card needed).
2. Worker → **Settings → Variables and Secrets** → add secret
   **`TOMTOM_KEY`** = your key.
3. Redeploy the Worker (paste the latest `worker.js`).

Test: open `https://<your-worker>.workers.dev/traffic` — you should get JSON with
`routes.purva` and `routes.ganga` travel times. The app's **Route (beta)** tab
reads this and adds the gate wait.

## GitHub token

[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
→ Fine-grained → Repository access: **only** `KagdassapuraRailwayCrossing` →
Permissions → **Actions: Read and write** → Generate → copy into `GH_TOKEN`.

> Do not also run a second scheduler (e.g. cron-job.org) or re-add a GitHub
> `schedule:` block — multiple schedulers would double the API calls and exceed
> the free budget.

# 🛠️ Deploying This for Your Own Railway Crossing

This guide walks you through setting up your own copy of this app for **any railway crossing**, anywhere — as long as RailRadar has live data for the two nearest stations.

No coding experience required for most of these steps.

---

## What you'll need

- A free GitHub account
- A free RailRadar API key ([railradar.in](https://railradar.in))
- 15–20 minutes

---

## Step 1 — Copy the repository

1. Go to the original repo on GitHub
2. Click **Fork** (top right) to create your own copy
3. Rename it if you like — for example `my-crossing-tracker`

---

## Step 2 — Find your crossing's details

You'll need:

- The **two nearest railway stations** on either side of your crossing
- Their **station codes** (e.g. `KJM`, `BLRR`) — look these up on RailRadar or Indian Railways' enquiry site
- The **distance** from each station to the crossing, in kilometers
- The crossing's **latitude and longitude** (right-click the location on Google Maps → copy coordinates)

---

## Step 3 — Update the crossing configuration

Open `src/lib/config.ts` and edit these values:

- `crossingId` — a short unique name, e.g. `"my-crossing"`
- `name` — the full display name of your crossing
- `latitude` / `longitude` — your crossing's coordinates
- `stationA` — the **further** station's code and name
- `stationB` — the **closer** station's code and name
- `distanceFromStationA` — distance in km from station A
- `distanceFromStationB` — distance in km from station B

Leave the other settings (`gateCloseBeforeSeconds`, `gateOpenAfterSeconds`, `tracks`, `bufferSeconds`) as-is unless you know your crossing behaves differently — these control how early the gate is predicted to close and how long after a train passes it reopens.

---

## Step 4 — Update the data-fetching workflow

Open `.github/workflows/refresh-data.yml` and replace every instance of:

- `KJM` → your station A's code
- `BLRR` → your station B's code

---

## Step 5 — Point the app at your own repo

Open `src/lib/config.ts` and find the `CACHE_JSON_URL` section near the bottom. Update:

- `GH_USER` → your GitHub username
- `GH_REPO` → your repo's name
- `GH_BRANCH` → usually `master` or `main`, whichever your repo uses

---

## Step 6 — Set up your secrets

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**
2. Add two new secrets:
   - `RAILRADAR_BASE` → `https://api.railradar.in` (or whatever your RailRadar base URL is)
   - `RAILRADAR_KEY` → your personal RailRadar API key

---

## Step 7 — Enable GitHub Pages

1. Go to **Settings → Pages**
2. Under **Source**, choose **GitHub Actions**
3. Save

---

## Step 8 — Update the build base path

Open `vite.config.ts` and change:

```
base: '/your-repo-name/'
```

This must exactly match your repository's name.

Also update the favicon reference in `index.html` if present, to match the same path.

---

## Step 9 — Push and deploy

1. Commit and push all your changes to the `master` (or `main`) branch
2. Go to **Actions** in your repo — you should see **Deploy to GitHub Pages** run automatically
3. Once it finishes (green checkmark), your site is live at:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
   ```

---

## Step 10 — Verify live data is flowing

1. Go to **Actions → Refresh crossing data → Run workflow** to trigger it manually
2. Click into the run and check the logs — you should see a line like:
   ```
   ✓ Wrote cache.json  generatedAt=...  KJM=12  BLRR=4
   ```
3. Open your live site — the status card should show real train data within a few seconds

---

## Troubleshooting

- **App shows "Data X min old"** → your `CACHE_JSON_URL` in `config.ts` likely points to the wrong username/repo — double check Step 5
- **0 trains showing, but the workflow says it ran successfully** → the API response format may differ slightly for your stations; check the workflow logs for the `first entry keys` line and adjust `scripts/parse_cache.py` if needed
- **Page is blank or 404s** → check that `base` in `vite.config.ts` exactly matches your repo name (Step 8)
- **Workflow fails immediately with a secrets error** → re-check Step 6, make sure there are no extra quotes or spaces in the secret values

---

## Adding a second crossing to the same app (optional, advanced)

This requires actual code changes:

1. Export a second `CrossingConfig` object from `config.ts`
2. Update `refresh-data.yml` to also fetch that crossing's two stations
3. Add a crossing-switcher to the UI so users can pick which one to view

This isn't covered step-by-step here since it touches several files — happy to help if you want to take this further.

#!/usr/bin/env python3
"""
Parses RailRadar live-board responses and writes public/data/cache.json.
Run as: python3 scripts/parse_cache.py <now_iso> <bypl_raw.json> <blrr_raw.json> <output.json>
"""
import json
import sys


def load(path):
    try:
        with open(path) as f:
            content = f.read().strip()
        if not content:
            return None
        return json.loads(content)
    except Exception as e:
        print(f"  Failed to parse {path}: {e}")
        return None


def extract_trains(raw, label):
    if raw is None:
        print(f"[{label}] No data (fetch failed) — returning empty list")
        return []
    try:
        entries = raw["data"]["trains"]
    except (KeyError, TypeError):
        print(f"[{label}] ERROR: no data.trains. Top keys: {list(raw.keys()) if isinstance(raw, dict) else type(raw)}")
        return []

    print(f"[{label}] {len(entries)} raw entries")
    if entries:
        print(f"[{label}] first entry keys: {list(entries[0].keys())}")

    trains = []
    for entry in entries:
        try:
            t = entry.get("train", {})
            stop = entry.get("stop", {})
            live = entry.get("live", {})

            no = str(t.get("number") or t.get("no") or t.get("trainNo") or "").strip()
            name = str(t.get("name") or t.get("trainName") or "").strip()
            if not no:
                continue

            sched = str(
                stop.get("scheduled_departure")
                or stop.get("departure")
                or stop.get("std")
                or ""
            ).strip()
            exp = str(
                stop.get("expected_departure")
                or stop.get("exp_dep")
                or stop.get("etd")
                or sched
            ).strip()
            status = str(live.get("status") or stop.get("status") or "scheduled").strip()
            try:
                delay = int(live.get("delay_minutes") or live.get("delay") or 0)
            except (TypeError, ValueError):
                delay = 0

            trains.append({
                "trainNo": no,
                "trainName": name,
                "status": status,
                "scheduledDepartureTime": sched,
                "expectedDepartureTime": exp,
                "delayMinutes": delay,
            })
        except Exception as e:
            print(f"[{label}] skipping malformed entry: {e}")

    print(f"[{label}] {len(trains)} trains normalised")
    if trains:
        print(f"[{label}] sample: {trains[0]['trainNo']} {trains[0]['trainName']} dep={trains[0]['scheduledDepartureTime']}")
    return trains


def main():
    if len(sys.argv) != 5:
        print("Usage: parse_cache.py <now_iso> <bypl_raw.json> <blrr_raw.json> <output.json>")
        sys.exit(1)

    now, bypl_path, blrr_path, out_path = sys.argv[1:5]
    print(f"NOW = {now}")

    bypl_raw = load(bypl_path)
    blrr_raw = load(blrr_path)

    bypl_trains = extract_trains(bypl_raw, "BYPL")
    blrr_trains = extract_trains(blrr_raw, "BLRR")

    # ── Filter junction noise from station A (BYPL) ──────────────────────────
    # BYPL is a junction: its live board also lists Kolar / Bangarpet /
    # Jolarpettai / Whitefield-line trains that never cross the Kaggadasapura
    # gate. A BYPL train is a real gate-crosser only if it runs the Salem-line
    # segment toward BLRR. We detect that with NO extra API calls:
    #   1. the train number also appears on the BLRR board (same Salem-line
    #      train seen at both stations), OR
    #   2. it's in a small static allowlist of trains that RailRadar's
    #      /v1/trains/between/BYPL/BLRR endpoint confirms run the segment.
    # BLRR is a single-line (non-junction) station, so its board is kept as-is.
    STATIC_CROSSING_TRAINS = {"16529", "16530", "66583", "66584"}
    blrr_numbers = {t["trainNo"] for t in blrr_trains}
    allowed = blrr_numbers | STATIC_CROSSING_TRAINS

    kept = [t for t in bypl_trains if t["trainNo"] in allowed]
    dropped = [t for t in bypl_trains if t["trainNo"] not in allowed]
    print(f"[BYPL] gate filter: kept {len(kept)}/{len(bypl_trains)} crossing trains; "
          f"dropped {len(dropped)} junction-line trains")
    if dropped:
        print("[BYPL] dropped (do not cross gate): "
              + ", ".join(f"{t['trainNo']} {t['trainName']}" for t in dropped[:12]))
    bypl_trains = kept

    if not bypl_trains and not blrr_trains:
        print("::warning::Both stations returned zero crossing trains — check raw entry keys above.")

    cache = {
        "stationA": {"stationCode": "BYPL", "trains": bypl_trains, "fetchedAt": now},
        "stationB": {"stationCode": "BLRR", "trains": blrr_trains, "fetchedAt": now},
        "generatedAt": now,
    }
    with open(out_path, "w") as f:
        json.dump(cache, f, indent=2)

    print(f"✓ Wrote {out_path}  generatedAt={now}  BYPL={len(bypl_trains)}  BLRR={len(blrr_trains)}")


if __name__ == "__main__":
    main()

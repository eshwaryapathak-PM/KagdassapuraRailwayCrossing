#!/usr/bin/env python3
"""
Parses RailRadar live-board responses and writes public/data/cache.json.
Run as: python3 scripts/parse_cache.py <now_iso> <kjm_raw.json> <blrr_raw.json> <output.json>
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
        print("Usage: parse_cache.py <now_iso> <kjm_raw.json> <blrr_raw.json> <output.json>")
        sys.exit(1)

    now, kjm_path, blrr_path, out_path = sys.argv[1:5]
    print(f"NOW = {now}")

    kjm_raw = load(kjm_path)
    blrr_raw = load(blrr_path)

    kjm_trains = extract_trains(kjm_raw, "KJM")
    blrr_trains = extract_trains(blrr_raw, "BLRR")

    if not kjm_trains and not blrr_trains:
        print("::warning::Both stations returned zero trains — check raw entry keys above.")

    cache = {
        "kjm": {"stationCode": "KJM", "trains": kjm_trains, "fetchedAt": now},
        "blrr": {"stationCode": "BLRR", "trains": blrr_trains, "fetchedAt": now},
        "generatedAt": now,
    }
    with open(out_path, "w") as f:
        json.dump(cache, f, indent=2)

    print(f"✓ Wrote {out_path}  generatedAt={now}  KJM={len(kjm_trains)}  BLRR={len(blrr_trains)}")


if __name__ == "__main__":
    main()

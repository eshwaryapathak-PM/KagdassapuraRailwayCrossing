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

            # Scheduled departure (clock time, e.g. "16:48")
            sched = str(
                stop.get("departure")
                or stop.get("scheduled_departure")
                or stop.get("std")
                or ""
            ).strip()

            # Expected (delay-adjusted) departure. RailRadar returns this as a full
            # ISO timestamp with timezone in `live.expectedDepartureTime`, e.g.
            # "2026-07-07T17:28:00+05:30". Passing the ISO through lets the browser
            # compute the true ETA regardless of its own timezone. Falls back to the
            # scheduled clock time only if no live expected time is available.
            exp = str(
                live.get("expectedDepartureTime")
                or live.get("expected_departure")
                or stop.get("expected_departure")
                or sched
            ).strip()

            # Scheduled arrival at the station (clock time) + delay-adjusted arrival
            sched_arr = str(stop.get("arrival") or "").strip()
            exp_arr = str(live.get("expectedArrivalTime") or sched_arr).strip()

            # Train origin/destination station codes (for "coming from → going to")
            src = str(t.get("source") or "").strip()
            dst = str(t.get("destination") or "").strip()

            # Delay in minutes (RailRadar: live.delayMinutes)
            delay_raw = live.get("delayMinutes")
            if delay_raw is None:
                delay_raw = live.get("delay_minutes") or live.get("delay") or 0
            try:
                delay = int(delay_raw)
            except (TypeError, ValueError):
                delay = 0

            # Status — RailRadar uses live.type ("upcoming", "departed", …).
            # Normalise anything indicating a cancellation to "cancelled" so the
            # prediction engine skips it.
            raw_status = str(
                live.get("type") or live.get("status") or stop.get("status") or "scheduled"
            ).strip().lower()
            is_cancelled = bool(
                live.get("cancelled") or t.get("cancelled") or entry.get("cancelled")
                or "cancel" in raw_status
            )
            status = "cancelled" if is_cancelled else raw_status

            trains.append({
                "trainNo": no,
                "trainName": name,
                "status": status,
                "scheduledDepartureTime": sched,
                "expectedDepartureTime": exp,
                "scheduledArrivalTime": sched_arr,
                "expectedArrivalTime": exp_arr,
                "source": src,
                "destination": dst,
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
    #   3. (best signal) its route runs to/from the Salem side — any train whose
    #      origin OR destination is south of the gate must physically cross it.
    #      This catches Salem-line trains that don't halt at BLRR, which the
    #      board-matching test alone would wrongly drop.
    SALEM_SIDE = {"BLRR", "CMLR", "HSRA", "DPJ", "SA", "KIK", "OME", "AEK"}
    STATIC_CROSSING_TRAINS = {"16529", "16530", "66583", "66584"}
    blrr_numbers = {t["trainNo"] for t in blrr_trains}
    allowed = blrr_numbers | STATIC_CROSSING_TRAINS

    def crosses_gate(t):
        return (
            t["trainNo"] in allowed
            or (t.get("source", "") or "").upper() in SALEM_SIDE
            or (t.get("destination", "") or "").upper() in SALEM_SIDE
        )

    kept = [t for t in bypl_trains if crosses_gate(t)]
    dropped = [t for t in bypl_trains if not crosses_gate(t)]
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

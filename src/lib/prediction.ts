/**
 * Prediction Engine
 *
 * Given live board data from BYPL and BLRR, this module:
 *  1. Identifies trains that will pass the crossing
 *  2. Calculates their ETA to the crossing
 *  3. Merges overlapping gate windows (multiple trains = one continuous closure)
 *  4. Emits a PredictionResult with confidence score
 *
 * Direction convention:
 *   AtoB = BYPL → Crossing → BLRR  (train seen departing BYPL or arriving BLRR)
 *   BtoA = BLRR → Crossing → BYPL  (train seen departing BLRR or arriving BYPL)
 */

import { addSeconds, differenceInSeconds, parseISO, isAfter, isBefore } from 'date-fns'
import type {
  CrossingConfig,
  LiveBoardEntry,
  StaticCache,
  ApproachingTrain,
  GateWindow,
  PredictionResult,
  CrossingState,
  TrainDirection,
} from '../types'
import { PREDICTION_CONFIG } from './config'

// ─── Speed model ─────────────────────────────────────────────────────────────
// We estimate time-to-crossing from distance using average speed assumptions.
// When live train status is available it will override these.
const AVG_SPEED_KMH = 60
const kmToSeconds = (km: number) => Math.round((km / AVG_SPEED_KMH) * 3600)

// ─── Parse a flexible time string into a Date ─────────────────────────────────
function parseTime(raw: string, referenceDate: Date): Date {
  if (!raw) return new Date(0)
  // Full ISO string
  if (raw.includes('T')) return parseISO(raw)
  // HH:mm or HH:mm:ss  → attach today's date
  const [h, m, s] = raw.split(':').map(Number)
  const d = new Date(referenceDate)
  d.setHours(h, m, s ?? 0, 0)
  return d
}

// ─── Stations SOUTH of the crossing (the Salem / Hosur side) ─────────────────
// A gate-crossing train always travels between the Bengaluru side (BYPL and
// beyond) and the Salem side (BLRR and beyond). Its TRUE direction therefore
// comes from its origin/destination — NOT from which station board it appears
// on. (A northbound train shows up on BYPL's board too, but it has already
// crossed the gate by the time it gets there.)
const SALEM_SIDE = new Set(['BLRR', 'CMLR', 'HSRA', 'DPJ', 'SA', 'KIK', 'OME', 'AEK'])

// true  = southbound (Bengaluru → Salem): crosses AFTER departing BYPL
// false = northbound (Salem → Bengaluru): crosses AFTER departing BLRR
// null  = unknown
function isSouthbound(e: LiveBoardEntry): boolean | null {
  const dest = (e.destination ?? '').toUpperCase()
  const src = (e.source ?? '').toUpperCase()
  if (dest && SALEM_SIDE.has(dest)) return true
  if (src && SALEM_SIDE.has(src)) return false
  return null
}

// ─── Build ApproachingTrain list ──────────────────────────────────────────────
function buildApproachingTrains(
  cache: StaticCache,
  crossing: CrossingConfig,
  now: Date,
  windowMinutes: number
): ApproachingTrain[] {
  const windowSeconds = windowMinutes * 60
  const transitA = kmToSeconds(crossing.distanceFromStationA) // BYPL ↔ crossing
  const transitB = kmToSeconds(crossing.distanceFromStationB) // BLRR ↔ crossing

  // The same train can appear on both boards — merge by train number first.
  const byNo = new Map<string, { bypl?: LiveBoardEntry; blrr?: LiveBoardEntry }>()
  for (const e of cache.stationA.trains) {
    if (e.trainNo) byNo.set(e.trainNo, { ...(byNo.get(e.trainNo) ?? {}), bypl: e })
  }
  for (const e of cache.stationB.trains) {
    if (e.trainNo) byNo.set(e.trainNo, { ...(byNo.get(e.trainNo) ?? {}), blrr: e })
  }

  const results: ApproachingTrain[] = []

  for (const pair of byNo.values()) {
    const info = pair.bypl ?? pair.blrr
    if (!info || info.status === 'cancelled') continue

    const guessed = isSouthbound(info)
    const south = guessed ?? !!pair.bypl // fall back to the old board assumption

    const direction: TrainDirection = south ? 'AtoB' : 'BtoA'
    const transitSeconds = south ? transitA : transitB
    const sourceCode = south ? crossing.stationA.code : crossing.stationB.code
    const sourceStation = south ? crossing.stationA.name : crossing.stationB.name

    // Station BEFORE the crossing for this direction (departure = predictive).
    const before = south ? pair.bypl : pair.blrr
    // Station AFTER it (arrival = back-compute, used only if that's all we have).
    const after = south ? pair.blrr : pair.bypl

    let crossingAt: Date | null = null
    if (before) {
      const t = before.expectedDepartureTime || before.scheduledDepartureTime
      if (t) crossingAt = addSeconds(parseTime(t, now), transitSeconds)
    }
    if (!crossingAt && after) {
      const t =
        after.expectedArrivalTime || after.scheduledArrivalTime ||
        after.expectedDepartureTime || after.scheduledDepartureTime
      if (t) crossingAt = addSeconds(parseTime(t, now), -(south ? transitB : transitA))
    }
    if (!crossingAt) continue

    const etaSeconds = differenceInSeconds(crossingAt, now)
    if (etaSeconds < -crossing.gateOpenAfterSeconds) continue
    if (etaSeconds > windowSeconds) continue

    const src = before ?? after
    results.push({
      trainNo: info.trainNo,
      trainName: info.trainName,
      direction,
      etaSeconds,
      crossingAt,
      progressToCrossing: transitSeconds > 0 ? 1 - etaSeconds / transitSeconds : 1,
      gateClosed: etaSeconds <= crossing.gateCloseBeforeSeconds,
      sourceStation,
      sourceCode,
      schedArr: src?.scheduledArrivalTime ?? '',
      schedDep: src?.scheduledDepartureTime ?? '',
      origin: info.source ?? '',
      destination: info.destination ?? '',
      delayMinutes: info.delayMinutes ?? 0,
    })
  }

  return results.sort((a, b) => a.etaSeconds - b.etaSeconds)
}

// ─── Build gate windows ───────────────────────────────────────────────────────
// Each window is [closeAt, openAt]. Overlapping windows are merged so we never
// produce alternating open/close events for back-to-back trains.
function buildGateWindows(
  trains: ApproachingTrain[],
  crossing: CrossingConfig,
  now: Date
): GateWindow[] {
  if (trains.length === 0) return []

  // Compute raw [close, open] interval for each train
  const intervals = trains.map(train => {
    const arrivalAt = addSeconds(now, train.etaSeconds)
    const closeAt   = addSeconds(arrivalAt, -crossing.gateCloseBeforeSeconds)
    const openAt    = addSeconds(arrivalAt,  crossing.gateOpenAfterSeconds)
    return { closeAt, openAt, train }
  })

  // Sort by closeAt
  intervals.sort((a, b) => a.closeAt.getTime() - b.closeAt.getTime())

  // Merge overlapping / adjacent intervals (with buffer)
  const merged: GateWindow[] = []
  let current = {
    closeAt: intervals[0].closeAt,
    openAt:  intervals[0].openAt,
    trains:  [intervals[0].train],
  }

  for (let i = 1; i < intervals.length; i++) {
    const iv = intervals[i]
    const bufferClose = addSeconds(current.openAt, crossing.bufferSeconds)

    if (isBefore(iv.closeAt, bufferClose)) {
      // Overlap — extend the window
      if (isAfter(iv.openAt, current.openAt)) {
        current.openAt = iv.openAt
      }
      current.trains.push(iv.train)
    } else {
      merged.push({ ...current, isCurrent: false })
      current = { closeAt: iv.closeAt, openAt: iv.openAt, trains: [iv.train] }
    }
  }
  merged.push({ ...current, isCurrent: false })

  // Mark current window (the one that straddles now)
  for (const w of merged) {
    if (isBefore(w.closeAt, now) && isAfter(w.openAt, now)) {
      w.isCurrent = true
    }
  }

  return merged
}

// ─── Confidence score ─────────────────────────────────────────────────────────
function calcConfidence(dataAgeSeconds: number, baseConfidence = 95): number {
  // No decay during the normal 10-min refresh window
  const decayStartSeconds = (PREDICTION_CONFIG.confidenceDecayStartMinutes ?? 10) * 60
  if (dataAgeSeconds <= decayStartSeconds) return baseConfidence
  const extraMinutes = Math.floor((dataAgeSeconds - decayStartSeconds) / 60)
  const decay = extraMinutes * PREDICTION_CONFIG.confidenceDecayPerMinute
  return Math.max(PREDICTION_CONFIG.minConfidence, baseConfidence - decay)
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function runPrediction(
  cache: StaticCache,
  crossing: CrossingConfig,
  now = new Date()
): PredictionResult {
  const generatedAt = parseISO(cache.generatedAt)
  const dataAgeSeconds = differenceInSeconds(now, generatedAt)

  const approachingTrains = buildApproachingTrains(
    cache,
    crossing,
    now,
    PREDICTION_CONFIG.approachingWindowMinutes
  )

  // Longer list for the Schedule tab — same fetched board data, wider horizon.
  const scheduleTrains = buildApproachingTrains(
    cache,
    crossing,
    now,
    PREDICTION_CONFIG.scheduleWindowMinutes
  )

  const allWindows = buildGateWindows(approachingTrains, crossing, now)
  const currentWindow = allWindows.find(w => w.isCurrent) ?? null
  const upcomingWindows = allWindows.filter(w => !w.isCurrent && isAfter(w.closeAt, now))

  // Determine crossing state
  let state: CrossingState = 'OPEN'
  if (currentWindow) {
    state = 'CLOSED'
  } else {
    const imminent = approachingTrains.find(
      t => t.etaSeconds > 0 && t.etaSeconds <= crossing.gateCloseBeforeSeconds
    )
    if (imminent) state = 'APPROACHING'
  }

  const confidence = calcConfidence(dataAgeSeconds)

  return {
    state,
    confidence,
    currentWindow,
    upcomingWindows,
    approachingTrains,
    scheduleTrains,
    lastUpdated: generatedAt,
    dataAgeSeconds,
  }
}

// ─── Utility: format ETA for display ─────────────────────────────────────────
export function formatEta(seconds: number): string {
  if (seconds <= 0) return 'now'
  if (seconds < 60) return `${seconds}s`
  const m = Math.round(seconds / 60)
  return `${m} min`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function windowDuration(w: GateWindow): string {
  const s = differenceInSeconds(w.openAt, w.closeAt)
  const m = Math.round(s / 60)
  return `~${m} min`
}

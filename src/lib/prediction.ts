/**
 * Prediction Engine
 *
 * Given live board data from KJM and BLRR, this module:
 *  1. Identifies trains that will pass the crossing
 *  2. Calculates their ETA to the crossing
 *  3. Merges overlapping gate windows (multiple trains = one continuous closure)
 *  4. Emits a PredictionResult with confidence score
 *
 * Direction convention:
 *   AtoB = KJM → Crossing → BLRR  (train seen departing KJM or arriving BLRR)
 *   BtoA = BLRR → Crossing → KJM  (train seen departing BLRR or arriving KJM)
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

// ─── Build ApproachingTrain list ──────────────────────────────────────────────
function buildApproachingTrains(
  cache: StaticCache,
  crossing: CrossingConfig,
  now: Date,
  windowMinutes: number
): ApproachingTrain[] {
  const windowSeconds = windowMinutes * 60
  const results: ApproachingTrain[] = []

  // Helper: process one station's board
  const process = (
    entries: LiveBoardEntry[],
    direction: TrainDirection,
    distanceKm: number,
    sourceStation: string
  ) => {
    for (const entry of entries) {
      if (entry.status === 'cancelled') continue

      // Use expected time (accounts for delay) or fall back to scheduled
      const timeStr = entry.expectedDepartureTime || entry.scheduledDepartureTime
      if (!timeStr) continue

      const departureTime = parseTime(timeStr, now)
      // seconds from station departure until crossing
      const transitSeconds = kmToSeconds(distanceKm)
      const etaDate = addSeconds(departureTime, transitSeconds)
      const etaSeconds = differenceInSeconds(etaDate, now)

      // Only include trains within the approaching window (and not already past)
      if (etaSeconds < -crossing.gateOpenAfterSeconds) continue
      if (etaSeconds > windowSeconds) continue

      // Avoid duplicates (same train can appear on both boards for double-tracking)
      if (results.find(r => r.trainNo === entry.trainNo)) continue

      results.push({
        trainNo: entry.trainNo,
        trainName: entry.trainName,
        direction,
        etaSeconds,
        gateClosed: etaSeconds <= crossing.gateCloseBeforeSeconds,
        sourceStation,
      })
    }
  }

  process(
    cache.kjm.trains,
    'AtoB',
    crossing.distanceFromStationA,
    crossing.stationA.name
  )
  process(
    cache.blrr.trains,
    'BtoA',
    crossing.distanceFromStationB,
    crossing.stationB.name
  )

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

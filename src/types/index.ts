// ─── Crossing Configuration ──────────────────────────────────────────────────

export interface StationRef {
  code: string
  name: string
}

export interface CrossingConfig {
  crossingId: string
  name: string
  latitude: number
  longitude: number
  stationA: StationRef      // nearer side  (e.g. BYPL)
  stationB: StationRef      // farther side (e.g. BLRR)
  distanceFromStationA: number  // km
  distanceFromStationB: number  // km
  tracks: number
  gateCloseBeforeSeconds: number
  gateOpenAfterSeconds: number
  bufferSeconds: number
}

// ─── RailRadar API Shapes ─────────────────────────────────────────────────────

export type TrainStatus = 'departed' | 'arrived' | 'scheduled' | 'cancelled'

export interface LiveBoardEntry {
  trainNo: string
  trainName: string
  status: TrainStatus
  scheduledDepartureTime: string   // ISO or HH:mm
  expectedDepartureTime: string
  scheduledArrivalTime?: string    // HH:mm at the station
  expectedArrivalTime?: string     // ISO or HH:mm
  source?: string                  // origin station code
  destination?: string             // destination station code
  delayMinutes: number
}

export interface LiveBoardResponse {
  stationCode: string
  trains: LiveBoardEntry[]
  fetchedAt: string
}

export interface TrainLocation {
  stationCode: string
  segmentProgress: number   // 0–1 fraction along current segment
  speedKmh: number
}

export interface TrainLiveResponse {
  trainNo: string
  trainName: string
  delayMinutes: number
  currentLocation: TrainLocation
  previousHalt: StationRef
  nextHalt: StationRef
}

export interface RouteGeometry {
  trainNo: string
  coordinates: [number, number][]
}

// ─── Prediction Engine ────────────────────────────────────────────────────────

export type TrainDirection = 'AtoB' | 'BtoA'   // BYPL→BLRR  or  BLRR→BYPL
export type CrossingState  = 'OPEN' | 'CLOSED' | 'APPROACHING'

export interface ApproachingTrain {
  trainNo: string
  trainName: string
  direction: TrainDirection
  etaSeconds: number            // seconds until crossing (based on delay-adjusted departure)
  crossingAt: Date              // clock time it reaches the crossing (delay-adjusted)
  progressToCrossing: number    // estimated 0=at source station … 1=at crossing (>1 past it)
  overdue: boolean              // its expected time passed but the board says it hasn't departed
  gateClosed: boolean
  sourceStation: string         // name of the station it departs from (BYPL or BLRR side)
  sourceCode: string            // 'BYPL' or 'BLRR'
  schedArr: string              // scheduled arrival at that station (HH:mm)
  schedDep: string              // scheduled departure from that station (HH:mm)
  origin: string                // train's origin station code
  destination: string           // train's destination station code
  delayMinutes: number          // live delay; ETA already accounts for it
}

export interface GateWindow {
  closeAt: Date
  openAt: Date
  trains: ApproachingTrain[]
  isCurrent: boolean
}

export interface PredictionResult {
  state: CrossingState
  confidence: number            // 0–100
  currentWindow: GateWindow | null
  upcomingWindows: GateWindow[]
  approachingTrains: ApproachingTrain[]   // next hour (Status)
  scheduleTrains: ApproachingTrain[]       // next 3 hours (Schedule tab)
  lastUpdated: Date
  dataAgeSeconds: number
}

// ─── Cached static JSON (written by GitHub Actions) ──────────────────────────

export interface StaticCacheEntry {
  stationCode: string
  trains: LiveBoardEntry[]
  fetchedAt: string               // ISO string
}

export interface StaticCache {
  stationA: StaticCacheEntry   // Baiyyappanahalli (BYPL) board
  stationB: StaticCacheEntry   // Belandur Road (BLRR) board
  generatedAt: string
}

// ─── Historical learning (future) ────────────────────────────────────────────

export interface HistoricalTiming {
  trainNo: string
  crossingId: string
  samples: number
  avgSecondsFromA: number
  avgSecondsFromB: number
}

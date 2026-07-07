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
  stationA: StationRef      // further away  (e.g. KJM)
  stationB: StationRef      // closer        (e.g. BLRR)
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

export type TrainDirection = 'AtoB' | 'BtoA'   // KJM→BLRR  or  BLRR→KJM
export type CrossingState  = 'OPEN' | 'CLOSED' | 'APPROACHING'

export interface ApproachingTrain {
  trainNo: string
  trainName: string
  direction: TrainDirection
  etaSeconds: number            // seconds until crossing
  gateClosed: boolean
  sourceStation: string
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
  approachingTrains: ApproachingTrain[]
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
  kjm: StaticCacheEntry
  blrr: StaticCacheEntry
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

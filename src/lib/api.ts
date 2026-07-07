import type {
  LiveBoardResponse,
  TrainLiveResponse,
  RouteGeometry,
  StaticCache,
} from '../types'
import { CACHE_JSON_URL } from './config'

const BASE = import.meta.env.VITE_RAILRADAR_BASE ?? ''
const KEY  = import.meta.env.VITE_RAILRADAR_KEY  ?? ''

const apiHeaders: Record<string, string> = KEY
  ? { 'x-api-key': KEY, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: apiHeaders })
  if (!res.ok) throw new Error(`RailRadar ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// ── Static cache ──────────────────────────────────────────────────────────────
// Fetches from raw.githubusercontent.com so it always reflects the latest
// committed cache.json — even without a Pages rebuild.

export async function fetchStaticCache(): Promise<StaticCache> {
  const url = `${CACHE_JSON_URL}?t=${Date.now()}`
  console.debug('[cache] fetching from:', url)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch cache.json: ${res.status} from ${url}`)

  const data = await res.json() as StaticCache
  console.debug('[cache] generatedAt:', data.generatedAt)
  return data
}

// ── RailRadar live endpoints ──────────────────────────────────────────────────

export async function fetchLiveBoard(stationCode: string): Promise<LiveBoardResponse> {
  return get<LiveBoardResponse>(`/v1/stations/${stationCode}/live`)
}

export async function fetchTrainLive(trainNo: string): Promise<TrainLiveResponse> {
  return get<TrainLiveResponse>(`/v1/trains/${trainNo}/live`)
}

export async function fetchTrainRoute(trainNo: string): Promise<RouteGeometry> {
  return get<RouteGeometry>(`/v1/trains/${trainNo}/route`)
}

// ── localStorage fallback ─────────────────────────────────────────────────────

const CACHE_KEY = 'rc_static_cache'
const CACHE_TTL = 15 * 60 * 1000  // keep local copy for 15 min max

interface LocalCacheEntry { data: StaticCache; savedAt: number }

export function saveToLocalCache(data: StaticCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }))
  } catch { /* storage full */ }
}

export function loadFromLocalCache(): StaticCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as LocalCacheEntry
    if (Date.now() - entry.savedAt > CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

import { useQuery } from '@tanstack/react-query'
import { addSeconds } from 'date-fns'
import type { PredictionResult, GateWindow } from '../types'
import { formatTime } from '../lib/prediction'
import { TRAFFIC_URL } from '../lib/config'

interface RouteData {
  label: string
  side: string
  origin: string
  sec?: number
  delaySec?: number
  freeSec?: number
  meters?: number
  error?: string
}
interface TrafficResp {
  routes?: { purva: RouteData; ganga: RouteData }
  error?: string
}

const mins = (s: number) => Math.max(1, Math.round(s / 60))

// Extra minutes of jam-clearing per minute the gate stays shut. A rough,
// tunable heuristic — we have no live queue sensor, so we estimate the backed-up
// traffic from how long the gate is/was closed. Raise it if the crossing jams
// badly, lower it if it clears fast.
const QUEUE_FACTOR = 0.6

// Gate impact if you arrive at `arrivalAt`:
//   waitSec  = time until the gate reopens (if you arrive while it's shut)
//   queueSec = estimated time to crawl through the backed-up jam after it opens
function gateImpact(arrivalAt: Date, prediction: PredictionResult) {
  const arr = arrivalAt.getTime()
  const windows = [prediction.currentWindow, ...prediction.upcomingWindows].filter(Boolean) as GateWindow[]
  for (const w of windows) {
    const close = w.closeAt.getTime()
    const open = w.openAt.getTime()
    const clearMs = QUEUE_FACTOR * (open - close) // full jam-clear time after reopening

    if (arr >= close && arr < open) {
      // Arriving while shut: wait for reopen + crawl past those who queued before you.
      return {
        waitSec: (open - arr) / 1000,
        queueSec: (QUEUE_FACTOR * (arr - close)) / 1000,
        reopenAt: w.openAt,
        blocked: true,
      }
    }
    if (arr >= open && arr < open + clearMs) {
      // Arriving just after reopen while the jam is still clearing.
      return { waitSec: 0, queueSec: (open + clearMs - arr) / 1000, reopenAt: w.openAt, blocked: true }
    }
  }
  return { waitSec: 0, queueSec: 0, reopenAt: null as Date | null, blocked: false }
}

export function RouteView({ prediction }: { prediction: PredictionResult }) {
  const { data, isLoading, isError } = useQuery<TrafficResp>({
    queryKey: ['traffic'],
    queryFn: async () => {
      const r = await fetch(`${TRAFFIC_URL}?t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`traffic ${r.status}`)
      return r.json()
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 1,
  })

  const unavailable = isError || (data && (data.error || !data.routes))

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090]">Real crossing time</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,166,35,0.12)', color: '#F5A623' }}>BETA</span>
      </div>
      <p className="text-[11px] text-[#5E7090] mb-4 leading-relaxed">
        Live driving time (traffic) <span className="text-[#C8D6E8]">plus</span> the gate wait
        <span className="text-[#C8D6E8]"> and an estimate of the jam</span> it takes to clear after the gate reopens —
        for each approach to the crossing.
      </p>

      {isLoading && (
        <div className="text-center text-[#5E7090] text-sm py-10">Checking live traffic…</div>
      )}

      {unavailable && (
        <div className="rounded-xl border border-[#3A4F6A] bg-[#1A2332] px-4 py-5 text-center">
          <div className="text-[#C8D6E8] text-sm">Live traffic unavailable</div>
          <div className="text-[#5E7090] text-[11px] mt-1.5 leading-relaxed">
            The traffic service isn't reachable yet. If you just set it up, make sure the Worker has a
            <span className="text-[#C8D6E8]"> TOMTOM_KEY</span> secret and is redeployed.
          </div>
        </div>
      )}

      {!isLoading && !unavailable && data?.routes && (
        <div className="space-y-3">
          {(['purva', 'ganga'] as const).map((k) => (
            <RouteCard key={k} route={data.routes![k]} prediction={prediction} />
          ))}
        </div>
      )}

      <div className="mt-5 text-[10px] text-[#3A4F6A] text-center leading-relaxed">
        Driving times: TomTom live traffic · gate wait: this app's prediction.
        Best-effort estimate — always look before you cross.
      </div>
    </div>
  )
}

function RouteCard({ route, prediction }: { route: RouteData; prediction: PredictionResult }) {
  if (route.error || route.sec == null) {
    return (
      <div className="rounded-xl border border-[#3A4F6A] bg-[#1A2332] px-4 py-3">
        <div className="text-[13px] text-[#C8D6E8] font-medium">{route.label}</div>
        <div className="text-[11px] text-[#5E7090] mt-1">Route unavailable right now</div>
      </div>
    )
  }

  const drivingSec = route.sec
  const arrivalAt = addSeconds(new Date(), drivingSec)
  const { waitSec, queueSec, reopenAt, blocked } = gateImpact(arrivalAt, prediction)
  const gateDelaySec = waitSec + queueSec
  const totalSec = drivingSec + gateDelaySec
  const heavy = (route.delaySec ?? 0) >= 60
  const totalColor = blocked ? '#FF4444' : heavy ? '#F5A623' : '#00C896'

  return (
    <div
      className="rounded-xl border bg-[#1A2332] px-4 py-3.5"
      style={{ borderColor: blocked ? 'rgba(255,68,68,0.4)' : '#3A4F6A' }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] text-[#C8D6E8] font-medium truncate">{route.label}</div>
          <div className="text-[11px] text-[#5E7090] mt-0.5">→ Kaggadasapura crossing · {route.side}</div>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <div className="text-2xl font-semibold leading-none" style={{ fontFamily: "'JetBrains Mono', monospace", color: totalColor }}>
            {mins(totalSec)} min
          </div>
          <div className="text-[10px] text-[#5E7090] mt-1">total right now</div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <span className="flex items-center gap-1.5">
          <span aria-hidden>🚗</span>
          <span className="text-[#C8D6E8]">{mins(drivingSec)} min drive</span>
          {heavy && <span className="text-[#F5A623]">heavy</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: blocked ? '#FF4444' : '#00C896' }} />
          <span style={{ color: blocked ? '#FF4444' : '#00C896' }}>
            {blocked ? `+${mins(gateDelaySec)} min gate` : 'gate clear'}
          </span>
        </span>
      </div>

      {blocked && reopenAt && (
        <div className="text-[10px] text-[#F5A623] mt-2 leading-relaxed">
          You'd reach the gate ~{formatTime(arrivalAt)} around a closure — reopens {formatTime(reopenAt)}
          {queueSec >= 30 && <> · +~{mins(queueSec)} min to clear the jam</>}.
        </div>
      )}
    </div>
  )
}

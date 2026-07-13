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

// How long the gate would hold you up if you arrive at `arrivalAt`.
function gateWait(arrivalAt: Date, prediction: PredictionResult) {
  const windows = [prediction.currentWindow, ...prediction.upcomingWindows].filter(Boolean) as GateWindow[]
  for (const w of windows) {
    if (arrivalAt.getTime() >= w.closeAt.getTime() && arrivalAt.getTime() < w.openAt.getTime()) {
      return { waitSec: Math.round((w.openAt.getTime() - arrivalAt.getTime()) / 1000), reopenAt: w.openAt }
    }
  }
  return { waitSec: 0, reopenAt: null as Date | null }
}

export function RouteView({ prediction }: { prediction: PredictionResult }) {
  const { data, isLoading, isError } = useQuery<TrafficResp>({
    queryKey: ['traffic'],
    queryFn: async () => {
      const r = await fetch(`${TRAFFIC_URL}?t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`traffic ${r.status}`)
      return r.json()
    },
    refetchInterval: 90_000,
    staleTime: 60_000,
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
        Live driving time (traffic) <span className="text-[#C8D6E8]">plus</span> the expected gate wait,
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
  const { waitSec, reopenAt } = gateWait(arrivalAt, prediction)
  const totalSec = drivingSec + waitSec
  const heavy = (route.delaySec ?? 0) >= 60
  const blocked = waitSec > 0
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
            {blocked ? `+${mins(waitSec)} min gate` : 'gate clear'}
          </span>
        </span>
      </div>

      {blocked && reopenAt && (
        <div className="text-[10px] text-[#F5A623] mt-2">
          You'd reach the gate ~{formatTime(arrivalAt)} during a closure — reopens {formatTime(reopenAt)}.
        </div>
      )}
    </div>
  )
}

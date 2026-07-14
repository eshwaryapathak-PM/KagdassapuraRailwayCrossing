import { useEffect, useState } from 'react'
import type { PredictionResult } from '../types'
import { formatTime, windowDuration, formatEta } from '../lib/prediction'

interface Props {
  prediction: PredictionResult
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const fmtLeft = (secs: number) => (secs <= 30 ? 'now' : `${Math.round(secs / 60)} min`)

export function StatusCard({ prediction }: Props) {
  const { state, currentWindow, upcomingWindows, dataAgeSeconds } = prediction

  // Live clock — re-render every 30s so the countdown ticks down on its own.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const isOpen       = state === 'OPEN'
  const isClosed     = state === 'CLOSED'
  const isApproaching = state === 'APPROACHING'

  const stateColor  = isClosed ? '#FF4444' : isApproaching ? '#F5A623' : '#00C896'
  const lampClass   = isClosed ? 'lamp-closed' : isApproaching ? 'lamp-warn' : 'lamp-open'
  const barColor    = stateColor

  const nextWindow  = currentWindow ?? upcomingWindows[0] ?? null

  // Countdown to the next state change (replaces the old confidence %).
  // CLOSED  → time until it reopens (bar empties across the closure).
  // OPEN    → time until it closes (bar empties across a 30-min horizon).
  let countdown: { label: string; secs: number; frac: number } | null = null
  if (isClosed && currentWindow) {
    const total  = (currentWindow.openAt.getTime() - currentWindow.closeAt.getTime()) / 1000
    const remain = Math.max(0, (currentWindow.openAt.getTime() - now.getTime()) / 1000)
    countdown = { label: 'Time until it reopens', secs: remain, frac: total > 0 ? clamp01(remain / total) : 0 }
  } else if (nextWindow) {
    const HORIZON = 30 * 60
    const remain  = Math.max(0, (nextWindow.closeAt.getTime() - now.getTime()) / 1000)
    countdown = { label: 'Time until it closes', secs: remain, frac: clamp01(remain / HORIZON) }
  }

  // Service window is 08:00–20:00 IST; data refreshes every 30 min in-window.
  // Warn only when data is clearly stale (>45 min), and word it based on whether
  // we're inside service hours (delayed refresh) or outside (updates paused).
  const istHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
      .format(now)
  )
  const inServiceWindow = istHour >= 8 && istHour < 20
  const isStale = dataAgeSeconds > 2700

  // Closures coming up AFTER the one shown in the cells above — lets people plan
  // for a second train arriving back-to-back or after a gap.
  const moreClosures = (isClosed ? upcomingWindows : upcomingWindows.slice(1)).slice(0, 2)

  // Interleave the OPEN windows between upcoming closures, so people can see how
  // long the gate stays open before it shuts again.
  type Seg =
    | { kind: 'open'; from: Date; to: Date; mins: number }
    | { kind: 'closed'; close: Date; open: Date; trains: number }
  const schedule: Seg[] = []
  if (nextWindow) {
    let prev = nextWindow
    for (const w of moreClosures) {
      const mins = Math.round((w.closeAt.getTime() - prev.openAt.getTime()) / 60000)
      if (mins > 0) schedule.push({ kind: 'open', from: prev.openAt, to: w.closeAt, mins })
      schedule.push({ kind: 'closed', close: w.closeAt, open: w.openAt, trains: w.trains.length })
      prev = w
    }
  }

  let subText = 'No trains within 20 min window'
  if (isClosed && currentWindow) {
    subText = `Reopens at ${formatTime(currentWindow.openAt)}`
  } else if (isApproaching) {
    const t = prediction.approachingTrains[0]
    subText = `${t.trainName} arriving in ${formatEta(t.etaSeconds)}`
  } else if (nextWindow) {
    subText = `Next closure ${formatTime(nextWindow.closeAt)}`
  }

  return (
    <div
      style={{ borderTop: `3px solid ${stateColor}` }}
      className="mx-4 mt-4 rounded-2xl border border-[#3A4F6A] bg-[#1A2332] p-5"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${lampClass}`}
          style={{ background: stateColor }}
        />
        <span className="text-[11px] font-medium tracking-widest uppercase text-[#5E7090]">
          Crossing status
        </span>
      </div>

      {/* Big status */}
      <div
        className="font-mono text-4xl font-semibold leading-none mb-1"
        style={{ fontFamily: "'JetBrains Mono', monospace", color: stateColor }}
      >
        {state}
      </div>
      <div className="text-xs text-[#5E7090] mt-1">{subText}</div>

      {/* Countdown bar — time until the next open/close change (ticks live) */}
      {countdown ? (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090]">
              {countdown.label}
            </span>
            <span
              className="text-[15px] font-semibold"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: isOpen ? '#00C896' : '#F5A623' }}
            >
              {fmtLeft(countdown.secs)}
            </span>
          </div>
          <div className="h-1.5 bg-[#2A3A55] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.round(countdown.frac * 100)}%`, background: barColor }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#2A3A55] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '100%', background: '#00C896' }} />
          </div>
          <span
            className="text-[11px] text-[#5E7090] whitespace-nowrap"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            no trains within the hour
          </span>
        </div>
      )}

      {/* Two info cells */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <InfoCell
          label={isClosed ? 'Reopens at' : 'Next closure'}
          value={nextWindow ? formatTime(isClosed ? nextWindow.openAt : nextWindow.closeAt) : '—'}
          sub={nextWindow && !isClosed ? `reopens ${formatTime(nextWindow.openAt)}` : undefined}
          highlight={!isOpen}
        />
        <InfoCell
          label="Duration"
          value={nextWindow ? windowDuration(nextWindow) : '—'}
          sub={nextWindow ? `${nextWindow.trains.length} train${nextWindow.trains.length > 1 ? 's' : ''}` : ''}
        />
      </div>

      {/* Interleaved open/closed schedule — shows the open window to cross before
          the gate shuts again (for back-to-back or gapped trains) */}
      {schedule.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#243247]">
          <div className="text-[9px] font-medium tracking-widest uppercase text-[#5E7090] mb-1.5">
            Coming up
          </div>
          {schedule.map((seg, i) =>
            seg.kind === 'open' ? (
              <div
                key={i}
                className="flex items-center justify-between text-[11px] py-1"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00C896' }} />
                  <span className="text-[#00C896]">Open {formatTime(seg.from)}–{formatTime(seg.to)}</span>
                </span>
                <span className="text-[#5E7090]">~{seg.mins} min to cross</span>
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center justify-between text-[11px] py-1"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FF4444' }} />
                  <span className="text-[#C8D6E8]">Closed {formatTime(seg.close)}–{formatTime(seg.open)}</span>
                </span>
                <span className="text-[#5E7090]">{seg.trains} train{seg.trains > 1 ? 's' : ''}</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Staleness note — refresh runs every 30 min inside the 08:00–20:00 IST window */}
      {isStale && (
        <div className="mt-3 text-[10px] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5" style={{ color: inServiceWindow ? '#F5A623' : '#5E7090' }}>
            <span>{inServiceWindow ? '⚠' : '🌙'}</span>
            <span>
              {inServiceWindow
                ? `Data ${Math.floor(dataAgeSeconds / 60)} min old — a scheduled refresh may have been delayed`
                : 'Live updates pause 20:00–08:00 IST — showing the last available data'}
            </span>
          </div>
          <div className="text-[#5E7090] pl-3.5">
            Last updated: {prediction.lastUpdated.toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })} (IST)
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className="bg-[#0F1624] rounded-xl border border-[#3A4F6A] px-3.5 py-3">
      <div className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090] mb-1.5">
        {label}
      </div>
      <div
        className="text-lg font-medium leading-none"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: highlight ? '#F5A623' : '#C8D6E8',
        }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-[#5E7090] mt-1">{sub}</div>}
    </div>
  )
}

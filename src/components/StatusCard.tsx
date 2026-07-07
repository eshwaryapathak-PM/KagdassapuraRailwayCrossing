import type { PredictionResult } from '../types'
import { formatTime, windowDuration, formatEta } from '../lib/prediction'

interface Props {
  prediction: PredictionResult
}

export function StatusCard({ prediction }: Props) {
  const { state, confidence, currentWindow, upcomingWindows, dataAgeSeconds } = prediction

  const isOpen       = state === 'OPEN'
  const isClosed     = state === 'CLOSED'
  const isApproaching = state === 'APPROACHING'

  const stateColor  = isClosed ? '#FF4444' : isApproaching ? '#F5A623' : '#00C896'
  const lampClass   = isClosed ? 'lamp-closed' : isApproaching ? 'lamp-warn' : 'lamp-open'
  const barColor    = stateColor

  const nextWindow  = currentWindow ?? upcomingWindows[0] ?? null

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

      {/* Confidence bar */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1 bg-[#3A4F6A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${confidence}%`, background: barColor }}
          />
        </div>
        <span
          className="text-[11px] min-w-[36px] text-right"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: '#5E7090' }}
        >
          {confidence}%
        </span>
      </div>

      {/* Two info cells */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <InfoCell
          label={isClosed ? 'Reopens at' : 'Next closure'}
          value={nextWindow ? formatTime(isClosed ? nextWindow.openAt : nextWindow.closeAt) : '—'}
          highlight={!isOpen}
        />
        <InfoCell
          label="Duration"
          value={nextWindow ? windowDuration(nextWindow) : '—'}
          sub={nextWindow ? `${nextWindow.trains.length} train${nextWindow.trains.length > 1 ? 's' : ''}` : ''}
        />
      </div>

      {/* Data age warning — only show if data is >15 min old (refresh runs every 10 min) */}
      {dataAgeSeconds > 600 && (
        <div className="mt-3 text-[10px] text-[#F5A623] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span>⚠</span>
            <span>Data {Math.floor(dataAgeSeconds / 60)} min old — refresh action may have failed</span>
          </div>
          <div className="text-[#5E7090] pl-3.5">
            Last updated: {prediction.lastUpdated.toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
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

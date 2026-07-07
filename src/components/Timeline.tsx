import type { GateWindow, PredictionResult } from '../types'
import { formatTime, windowDuration } from '../lib/prediction'
import { isBefore } from 'date-fns'

interface Props {
  prediction: PredictionResult
}

export function Timeline({ prediction }: Props) {
  const now = new Date()
  const { currentWindow, upcomingWindows } = prediction
  const allWindows = [...(currentWindow ? [currentWindow] : []), ...upcomingWindows]

  if (allWindows.length === 0) {
    return (
      <div className="p-4 text-center text-[#5E7090] text-sm pt-12">
        No upcoming closures predicted in the next 20 minutes.
        <br />
        <span className="text-[11px] text-[#3A4F6A] block mt-1">
          Data refreshes every 10 minutes
        </span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090] mb-4">
        Predicted gate schedule
      </div>

      {allWindows.map((window, i) => (
        <WindowItem key={i} window={window} now={now} isFirst={i === 0} />
      ))}

      <div className="mt-6 text-[10px] text-[#3A4F6A] text-center">
        Predictions based on scheduled departure times + distance model
      </div>
    </div>
  )
}

function WindowItem({
  window,
  now,
  isFirst,
}: {
  window: GateWindow
  now: Date
  isFirst: boolean
}) {
  const isCurrent = window.isCurrent
  const isPast = isBefore(window.openAt, now)
  const opacity = isPast ? 'opacity-40' : 'opacity-100'

  return (
    <div className={`relative ${opacity}`}>
      {/* Closed event */}
      <div className="flex items-start gap-3.5 pb-0">
        <div className="flex flex-col items-center">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5"
            style={{
              background: isCurrent ? 'rgba(255,68,68,0.2)' : 'rgba(255,68,68,0.1)',
              border: `1px solid ${isCurrent ? 'rgba(255,68,68,0.5)' : 'rgba(255,68,68,0.2)'}`,
              color: '#FF4444',
            }}
          >
            ✕
          </div>
          <div className="w-px flex-1 bg-[#3A4F6A] min-h-[32px]" />
        </div>
        <div className="pb-1 flex-1">
          {isCurrent && (
            <div
              className="text-[9px] font-medium tracking-widest uppercase mb-0.5"
              style={{ color: '#F5A623' }}
            >
              now
            </div>
          )}
          <div
            className="text-base font-medium leading-tight"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: isCurrent ? '#F5A623' : '#C8D6E8',
            }}
          >
            {formatTime(window.closeAt)}
          </div>
          <div className="text-xs text-[#5E7090] mt-0.5">Gate closes</div>
          <div
            className="text-[11px] mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: '#3A4F6A' }}
          >
            {window.trains.map(t => t.trainNo).join(' + ')}
          </div>
        </div>
        <div
          className="text-[11px] text-[#5E7090] mt-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {windowDuration(window)}
        </div>
      </div>

      {/* Open event */}
      <div className="flex items-start gap-3.5">
        <div className="flex flex-col items-center">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5"
            style={{
              background: 'rgba(0,200,150,0.1)',
              border: '1px solid rgba(0,200,150,0.25)',
              color: '#00C896',
            }}
          >
            ↑
          </div>
          {!isFirst && <div className="w-px flex-1 bg-transparent min-h-[24px]" />}
          <div className="w-px flex-1 bg-[#3A4F6A] min-h-[24px]" />
        </div>
        <div className="pb-4 flex-1">
          <div
            className="text-base font-medium leading-tight"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: '#C8D6E8',
            }}
          >
            {formatTime(window.openAt)}
          </div>
          <div className="text-xs text-[#5E7090] mt-0.5">Gate opens</div>
        </div>
      </div>
    </div>
  )
}

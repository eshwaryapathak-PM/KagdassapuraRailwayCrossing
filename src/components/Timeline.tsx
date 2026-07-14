import type { ApproachingTrain, PredictionResult } from '../types'
import { formatTime, formatEta } from '../lib/prediction'

interface Props {
  prediction: PredictionResult
}

export function Timeline({ prediction }: Props) {
  const trains = prediction.scheduleTrains

  if (trains.length === 0) {
    return (
      <div className="p-4 text-center text-[#5E7090] text-sm pt-12">
        No trains crossing in the next 3 hours.
        <br />
        <span className="text-[11px] text-[#3A4F6A] block mt-1">
          Updated every 30 minutes (8 AM–8 PM IST)
        </span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090]">
          Trains crossing · next 3 hours
        </span>
        <span className="text-[10px] text-[#3A4F6A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {trains.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {trains.map((t) => (
          <TrainScheduleRow key={t.trainNo} t={t} />
        ))}
      </div>

      <div className="mt-6 text-[10px] text-[#3A4F6A] text-center leading-relaxed">
        Live board from RailRadar (BYPL + BLRR) · times include running delays ·
        crossing time estimated from distance · refreshes every 30 min.
      </div>
    </div>
  )
}

function TrainScheduleRow({ t }: { t: ApproachingTrain }) {
  const barColor = t.direction === 'AtoB' ? '#00C896' : '#5E7090'
  return (
    <div className="rounded-xl border border-[#3A4F6A] bg-[#1A2332] px-3.5 py-3 flex gap-3">
      <div className="w-1 rounded-full flex-shrink-0" style={{ background: barColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-semibold text-[#C8D6E8]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {t.trainNo}
          </span>
          {t.delayMinutes > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,166,35,0.12)', color: '#F5A623', fontFamily: "'JetBrains Mono', monospace" }}
            >
              +{t.delayMinutes}m late
            </span>
          )}
        </div>

        <div className="text-[11px] text-[#7C8CA5] truncate">{t.trainName}</div>

        <div
          className="text-[10px] text-[#5E7090] mt-1.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          from {t.sourceCode} · {t.sourceStation}
        </div>

        <div
          className="text-[11px] mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {t.schedArr && <span className="text-[#5E7090]">arr {t.schedArr}</span>}
          {t.schedDep && <span className="text-[#5E7090]">dep {t.schedDep}</span>}
          <span className="text-[#00C896]">→ crosses ~{formatTime(t.crossingAt)}</span>
          <span className="text-[#3A4F6A]">
            {t.etaSeconds < 0 ? 'passed' : `in ${formatEta(t.etaSeconds)}`}
          </span>
        </div>
      </div>
    </div>
  )
}

import type { ApproachingTrain } from '../types'
import { formatEta } from '../lib/prediction'

interface Props {
  trains: ApproachingTrain[]
}

export function TrainList({ trains }: Props) {
  if (trains.length === 0) {
    return (
      <div className="mx-4 mt-2.5 rounded-xl border border-[#3A4F6A] bg-[#1A2332] px-4 py-5 text-center">
        <div className="text-[#5E7090] text-sm">No trains approaching</div>
        <div className="text-[#3A4F6A] text-xs mt-1">Showing trains within 20 min window</div>
      </div>
    )
  }

  return (
    <div className="mx-4 mt-2.5 rounded-xl border border-[#3A4F6A] bg-[#1A2332] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090]">
          Approaching trains
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full border"
          style={{
            background: 'rgba(245,166,35,0.1)',
            color: '#F5A623',
            borderColor: 'rgba(245,166,35,0.25)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {trains.length} tracked
        </span>
      </div>

      {trains.map((train, i) => (
        <TrainRow key={train.trainNo} train={train} isFirst={i === 0} />
      ))}
    </div>
  )
}

function TrainRow({ train, isFirst }: { train: ApproachingTrain; isFirst: boolean }) {
  const isClose = train.etaSeconds <= 600  // <10 min
  const isPast  = train.etaSeconds < 0
  const etaColor = isPast ? '#5E7090' : isClose ? '#FF4444' : '#F5A623'

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderTop: isFirst ? 'none' : '1px solid #3A4F6A' }}
    >
      {/* Direction indicator */}
      <div
        className="w-1.5 h-8 rounded-full flex-shrink-0"
        style={{ background: train.direction === 'AtoB' ? '#00C896' : '#5E7090' }}
      />

      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-medium text-[#C8D6E8]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {train.trainNo}
        </div>
        <div className="text-[11px] text-[#5E7090] truncate">{train.trainName}</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div
          className="text-xs font-medium"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: etaColor }}
        >
          {formatEta(train.etaSeconds)}
        </div>
        <div className="text-[10px] text-[#3A4F6A] mt-0.5">
          {train.direction === 'AtoB' ? '→ BLRR' : '← KJM'}
        </div>
      </div>

      {train.gateClosed && !isPast && (
        <div
          className="text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,68,68,0.1)', color: '#FF4444' }}
        >
          GATE
        </div>
      )}
    </div>
  )
}

import type { CrossingState } from '../types'

interface Props {
  state: CrossingState
  onRefresh: () => void
  isRefreshing: boolean
}

const stateColor: Record<CrossingState, string> = {
  OPEN:       '#00C896',
  CLOSED:     '#FF4444',
  APPROACHING:'#F5A623',
}

const lampClass: Record<CrossingState, string> = {
  OPEN:       'lamp-open',
  CLOSED:     'lamp-closed',
  APPROACHING:'lamp-warn',
}

export function AppHeader({ state, onRefresh, isRefreshing }: Props) {
  const color = stateColor[state]
  const lamp  = lampClass[state]

  return (
    <header className="sticky top-0 z-20 bg-[#0F1624] border-b border-[#3A4F6A]">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${lamp}`}
              style={{ background: color }}
            />
            <span className="text-[13px] font-medium text-[#5E7090] tracking-tight">
              Kaggadasapura Railway Crossing Status
            </span>
          </div>
          <div
            className="text-[10px] text-[#3A4F6A] mt-0.5 ml-5.5"
            style={{ fontFamily: "'JetBrains Mono', monospace", marginLeft: 22 }}
          >
            KJM · 6.7 km — BLRR · 1.5 km
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-[#3A4F6A] hover:text-[#5E7090] transition-colors p-1 mt-0.5"
          aria-label="Refresh data"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isRefreshing ? 'animate-spin' : ''}
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </header>
  )
}

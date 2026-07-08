import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppHeader } from './components/AppHeader'
import { StatusCard } from './components/StatusCard'
import { TrainList } from './components/TrainList'
import { Timeline } from './components/Timeline'
import { CrossingMap } from './components/CrossingMap'
import { BottomNav } from './components/BottomNav'
import { usePrediction } from './hooks/usePrediction'

const queryClient = new QueryClient()

type Tab = 'status' | 'timeline' | 'map'

function Inner() {
  const [tab, setTab] = useState<Tab>('status')
  const { prediction, isLoading, isError, error, refetch } = usePrediction()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-4 h-4 rounded-full lamp-open" style={{ background: '#00C896' }} />
        <span className="text-[#5E7090] text-sm">Loading crossing data…</span>
      </div>
    )
  }

  if (isError || !prediction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8 text-center">
        <div className="text-[#C8D6E8] text-sm font-medium">Could not load crossing data</div>
        <div className="text-[#5E7090] text-xs">{error?.message ?? 'Unknown error'}</div>
        <button
          onClick={() => refetch()}
          className="mt-2 text-xs px-4 py-2 rounded-lg border border-[#3A4F6A] text-[#5E7090]"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[420px] mx-auto min-h-screen relative">
      <AppHeader state={prediction.state} />
      <main className="pb-24">
        {tab === 'status' && (
          <>
            <StatusCard prediction={prediction} />
            <TrainList trains={prediction.approachingTrains} />
            <div className="mx-4 mt-3 flex items-center justify-between text-[11px] text-[#3A4F6A]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full lamp-open" style={{ background: '#00C896' }} />
                Auto-refresh · 30 min · 8AM–8PM IST
              </div>
              <div>
                Updated: {prediction.lastUpdated.toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })} IST
              </div>
            </div>
            <div className="mx-4 mt-2 text-[10px] leading-relaxed text-[#3A4F6A]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              To stay within the free train-data API limit, this board auto-refreshes
              every 30 min between 8 AM and 8 PM IST. There is no manual refresh.
            </div>

            <details className="mx-4 mt-4 rounded-xl border border-[#243247] bg-[#131C2E] overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-medium text-[#C8D6E8] flex items-center gap-2">
                <span aria-hidden>ℹ️</span> How this works
              </summary>
              <div className="px-4 pb-4 pt-1 text-[12px] leading-relaxed text-[#7C8CA5] space-y-2">
                <p>
                  This board predicts when the Kaggadasapura railway gate is likely to
                  be <span className="text-[#00C896] font-medium">open</span>,{' '}
                  <span className="text-[#F5A623] font-medium">closing soon</span>, or{' '}
                  <span className="text-[#FF4444] font-medium">closed</span>.
                </p>
                <p>
                  It reads live train departures — <span className="text-[#C8D6E8]">including any
                  running delays</span> — from the two stations on either side,
                  <span className="text-[#C8D6E8]"> Baiyyappanahalli (BYPL)</span> and
                  <span className="text-[#C8D6E8]"> Belandur Road (BLRR)</span>, estimates
                  when each train reaches the crossing, and assumes the gate closes about
                  5 minutes before a train passes and reopens ~2 minutes after.
                </p>
                <p>
                  Data refreshes every 30 minutes (8 AM–8 PM IST) to stay within a free API
                  limit. These are <span className="text-[#C8D6E8]">best-effort estimates</span>,
                  not official railway signals — always look before you cross.
                </p>
              </div>
            </details>
          </>
        )}
        {tab === 'timeline' && <Timeline prediction={prediction} />}
        {tab === 'map' && <CrossingMap prediction={prediction} />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  )
}

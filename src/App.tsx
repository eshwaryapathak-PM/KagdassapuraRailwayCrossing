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
      <AppHeader state={prediction.state} onRefresh={() => refetch()} isRefreshing={isLoading} />
      <main className="pb-24">
        {tab === 'status' && (
          <>
            <StatusCard prediction={prediction} />
            <TrainList trains={prediction.approachingTrains} />
            <div className="mx-4 mt-3 flex items-center justify-between text-[11px] text-[#3A4F6A]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full lamp-open" style={{ background: '#00C896' }} />
                Live · Refreshes every 10 min
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

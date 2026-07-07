import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchStaticCache, saveToLocalCache, loadFromLocalCache } from '../lib/api'
import { runPrediction } from '../lib/prediction'
import { KAGGADASAPURA, PREDICTION_CONFIG } from '../lib/config'
import type { PredictionResult, StaticCache } from '../types'

const REFETCH_MS = PREDICTION_CONFIG.refreshIntervalMinutes * 60 * 1000

// ─── Raw cache query ──────────────────────────────────────────────────────────
export function useStaticCache() {
  return useQuery<StaticCache, Error>({
    queryKey: ['staticCache'],
    queryFn: async () => {
      try {
        const data = await fetchStaticCache()
        saveToLocalCache(data)
        return data
      } catch (err) {
        // On network failure, serve stale local cache
        const local = loadFromLocalCache()
        if (local) return local
        throw err
      }
    },
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 2,
  })
}

// ─── Derived prediction ───────────────────────────────────────────────────────
export function usePrediction(): {
  prediction: PredictionResult | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  isStale: boolean
} {
  const { data: cache, isLoading, isError, error, refetch } = useStaticCache()

  const prediction = useMemo(() => {
    if (!cache) return null
    return runPrediction(cache, KAGGADASAPURA)
  }, [cache])

  const isStale = prediction
    ? prediction.dataAgeSeconds > PREDICTION_CONFIG.cacheMinutes * 60
    : false

  return {
    prediction,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    isStale,
  }
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { jobs, Job } from '../api/client'

interface UseJobProgressReturn {
  job: Job | null
  loading: boolean
  error: string | null
  isRunning: boolean
  isDone: boolean
  isFailed: boolean
  /** Which transport is active */
  transport: 'ws' | 'poll' | 'idle'
}

interface WsMessage {
  type: 'progress' | 'completed' | 'failed'
  pct?: number
  step?: string
  summary?: Record<string, unknown>
  error?: string
}

/**
 * Tracks job progress via WebSocket with automatic HTTP polling fallback.
 *
 * 1. Tries to connect to ws://{host}/ws/jobs/{jobId}
 * 2. If WS connects, uses real-time messages for progress updates
 * 3. If WS fails or disconnects, falls back to polling GET /api/jobs/{jobId}
 *
 * Pass `null` to disable (e.g. before a job has been created).
 */
export function useJobProgress(
  jobId: string | null,
  intervalMs = 2000,
): UseJobProgressReturn {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transport, setTransport] = useState<'ws' | 'poll' | 'idle'>('idle')

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  // Apply a WS message to the job state
  const applyWsMessage = useCallback((msg: WsMessage) => {
    setJob((prev) => {
      if (!prev) return prev
      switch (msg.type) {
        case 'progress':
          return {
            ...prev,
            status: 'running' as const,
            progress_pct: msg.pct ?? prev.progress_pct,
            current_step: msg.step ?? prev.current_step,
          }
        case 'completed':
          return {
            ...prev,
            status: 'completed' as const,
            progress_pct: 100,
            completed_at: new Date().toISOString(),
          }
        case 'failed':
          return {
            ...prev,
            status: 'failed' as const,
            error_message: msg.error ?? 'Job failed',
          }
        default:
          return prev
      }
    })

    if (msg.type === 'completed') {
      setError(null)
    } else if (msg.type === 'failed') {
      setError(msg.error ?? 'Job failed')
    }
  }, [])

  // Start polling as fallback
  const startPolling = useCallback(() => {
    if (!jobId || timerRef.current) return
    setTransport('poll')

    const poll = async () => {
      try {
        const data = await jobs.get(jobId)
        setJob(data)
        setLoading(false)

        if (data.status === 'completed' || data.status === 'failed') {
          clearPolling()
          if (data.status === 'failed') {
            setError(data.error_message || 'Job failed')
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job status')
        setLoading(false)
      }
    }

    poll()
    timerRef.current = setInterval(poll, intervalMs)
  }, [jobId, intervalMs, clearPolling])

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setLoading(false)
      setError(null)
      setTransport('idle')
      closeWs()
      clearPolling()
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    // First do an HTTP fetch to get initial state
    jobs.get(jobId).then((data) => {
      if (cancelled) return
      setJob(data)
      setLoading(false)

      // If already terminal, don't bother connecting
      if (data.status === 'completed' || data.status === 'failed') {
        if (data.status === 'failed') setError(data.error_message || 'Job failed')
        setTransport('idle')
        return
      }

      // Try WebSocket
      try {
        const apiUrl = import.meta.env.VITE_API_URL
        const wsBase = apiUrl
          ? apiUrl.replace(/^http/, 'ws')
          : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
        const wsUrl = `${wsBase}/ws/jobs/${jobId}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (cancelled) { ws.close(); return }
          setTransport('ws')
          clearPolling() // stop polling if it was running
        }

        ws.onmessage = (event) => {
          if (cancelled) return
          try {
            const msg: WsMessage = JSON.parse(event.data)
            applyWsMessage(msg)

            if (msg.type === 'completed' || msg.type === 'failed') {
              ws.close()
            }
          } catch {
            // ignore malformed messages
          }
        }

        ws.onerror = () => {
          if (cancelled) return
          ws.close()
        }

        ws.onclose = () => {
          if (cancelled) return
          wsRef.current = null
          // Fall back to polling if job is still running
          setJob((current) => {
            if (current && current.status !== 'completed' && current.status !== 'failed') {
              startPolling()
            }
            return current
          })
        }
      } catch {
        // WebSocket not supported or blocked — use polling
        if (!cancelled) startPolling()
      }
    }).catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to fetch job status')
      setLoading(false)
      // Try polling anyway in case it was a transient error
      startPolling()
    })

    return () => {
      cancelled = true
      closeWs()
      clearPolling()
    }
  }, [jobId, closeWs, clearPolling, startPolling, applyWsMessage])

  return {
    job,
    loading,
    error,
    isRunning: job?.status === 'running' || job?.status === 'pending',
    isDone: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    transport,
  }
}

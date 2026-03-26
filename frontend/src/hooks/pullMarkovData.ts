/**
 * useMarkovData.ts
 * ────────────────
 * Client-side hook for loading the transition matrix.
 * Handles loading/error states and falls back to static data if the fetch fails.
 *
 * Usage:
 *   const { nodes, edges, loading, error } = useMarkovData()           // static JSON
 *   const { nodes, edges, loading, error } = useMarkovData(projectId)  // from API
 */

import { useState, useEffect } from 'react'
import type { Node, Edge } from 'reactflow'
import { loadMarkovData } from './dataLoader'
import { fallbackNodes, fallbackEdges } from '../data/mockData'

interface UseMarkovDataResult {
  existingNodes: Node[]
  existingEdges: Edge[]
  loading: boolean
  error: string | null
  stats: {
    nSequences: number
    nStates: number
    nTransitions: number
  } | null
}

/**
 * @param projectId  When provided, fetches from /api/projects/{id}/markov.
 *                   When omitted, fetches the static JSON from /public/data/.
 */
export function useMarkovData(projectId?: string): UseMarkovDataResult {
  const [existingNodes, setNodes] = useState<Node[]>(fallbackNodes)
  const [existingEdges, setEdges] = useState<Edge[]>(fallbackEdges)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<UseMarkovDataResult['stats']>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const data = await loadMarkovData(projectId)
        if (cancelled) return
        setNodes(data.nodes)
        setEdges(data.edges)
        setStats(data.stats)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.warn('[useMarkovData] Failed to load, using fallback data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setNodes(fallbackNodes)
        setEdges(fallbackEdges)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [projectId])

  return { existingNodes, existingEdges, loading, error, stats }
}
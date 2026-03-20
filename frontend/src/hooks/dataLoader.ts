/**
 * dataLoader.ts
 * ─────────────
 * Transforms transition_matrix.json (output of 02_markov_builder.py)
 * into React Flow Node[] and Edge[] for the workflow diagram.
 *
 * USAGE (in any component or page):
 *
 *   import { loadMarkovData } from '@/lib/dataLoader'
 *
 *   const { nodes, edges, roleStats, toolBuckets } = await loadMarkovData()
 *
 * DATA SOURCE (for prototyping):
 *   Drop transition_matrix.json into your /public/data/ folder.
 *   Later, swap the fetch URL for your real API endpoint.
 */

import type { Node, Edge } from 'reactflow'
import type { TransitionMatrixJSON } from '../schema'

// ─── Config ───────────────────────────────────────────────────────────────────

// Where to fetch the JSON during prototyping.
// Swap this for `/api/markov` once you add a backend route.
const DATA_URL = '/data/transition_matrix.json'

// Nodes that should always be rendered as terminal (success/fail) bubbles.
// The builder appends a synthetic "END" node; real terminal names come from
// your pipeline_nodes list — extend this set as needed.
const TERMINAL_SUCCESS = new Set(['qualified', 'closed-won', 'END'])
const TERMINAL_FAIL = new Set([
  'not-qualified',
  'unsubscribed',
  'cold',
  'disqualified',
  'no-show',
])

// How to bucket automation potential based on avg node duration (minutes).
// Tune these thresholds to match your domain.
function inferAutomatable(avgMin: number): 'high' | 'medium' | 'low' {
  if (avgMin >= 30) return 'high'
  if (avgMin >= 10) return 'medium'
  return 'low'
}

// ─── Layout helper ────────────────────────────────────────────────────────────
// Simple left-to-right topological layout.
// Replace with ELK / Dagre if you want auto-routing later.

function assignPositions(
  states: string[],
  edges: MarkovEdge[],
): Record<string, { x: number; y: number }> {
  // Build adjacency to detect in-degree
  const inDegree: Record<string, number> = {}
  const outEdges: Record<string, string[]> = {}

  for (const s of states) {
    inDegree[s] = 0
    outEdges[s] = []
  }

  for (const e of edges) {
    if (e.source !== e.target) {
      inDegree[e.target] = (inDegree[e.target] ?? 0) + 1
      outEdges[e.source].push(e.target)
    }
  }

  // Topological BFS to assign column (depth)
  const depth: Record<string, number> = {}
  const queue = states.filter((s) => inDegree[s] === 0)
  queue.forEach((s) => (depth[s] = 0))

  while (queue.length) {
    const cur = queue.shift()!
    for (const nxt of outEdges[cur] ?? []) {
      depth[nxt] = Math.max(depth[nxt] ?? 0, (depth[cur] ?? 0) + 1)
      queue.push(nxt)
    }
  }

  // Group by depth → assign y positions within each column
  const cols: Record<number, string[]> = {}
  for (const s of states) {
    const d = depth[s] ?? 0
    cols[d] = cols[d] ?? []
    cols[d].push(s)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  const X_STEP = 320
  const Y_STEP = 190

  for (const [col, nodes] of Object.entries(cols)) {
    const x = Number(col) * X_STEP
    nodes.forEach((id, idx) => {
      positions[id] = { x, y: idx * Y_STEP }
    })
  }

  return positions
}

// ─── Transforms ───────────────────────────────────────────────────────────────

import type { MarkovEdge } from '../schema'

function buildNodes(data: TransitionMatrixJSON): Node[] {
  const { states } = data.metadata
  const positions = assignPositions(states, data.edge_list)

  return states.map((id) => {
    const isSuccess = TERMINAL_SUCCESS.has(id)
    const isFail = TERMINAL_FAIL.has(id)
    const isTerminal = isSuccess || isFail

    if (isTerminal) {
      return {
        id,
        type: 'terminalNode',
        position: positions[id] ?? { x: 800, y: 0 },
        data: {
          label: formatLabel(id),
          nodeType: isSuccess ? 'success' : 'fail',
        },
      }
    }

    // Task node — derive stats from the builder output
    const durationSamples = data.node_durations[id] ?? []
    const avgMin =
      durationSamples.length > 0
        ? durationSamples.reduce((a, b) => a + b, 0) / durationSamples.length
        : 0

    return {
      id,
      type: 'taskNode',
      position: positions[id] ?? { x: 0, y: 0 },
      data: {
        label: formatLabel(id),
        // tools: not in telemetry JSON — augment via the toolEnrichment map below
        tools: TOOL_ENRICHMENT[id] ?? [],
        minutes: Math.round(avgMin),
        automatable: inferAutomatable(avgMin),
        // raw samples exposed for custom tooltips
        durationSamples,
      },
    }
  })
}

function buildEdges(data: TransitionMatrixJSON): Edge[] {
  const sStyle = { stroke: '#10B981', strokeWidth: 2 }
  const fStyle = { stroke: '#EF4444', strokeWidth: 2 }
  const pStyle = { stroke: '#F59E0B', strokeWidth: 2 }
  const sLbl = { fill: '#10B981', fontWeight: 700, fontSize: 11 }
  const fLbl = { fill: '#EF4444', fontWeight: 700, fontSize: 11 }
  const pLbl = { fill: '#F59E0B', fontWeight: 700, fontSize: 11 }
  const bg = { fill: '#0F1629', fillOpacity: 0.9 }
  const pad: [number, number] = [4, 8]

  // Only render edges above a minimum probability to keep the graph readable
  const MIN_PROB = 0.05

  return data.edge_list
    .filter(
      (e) =>
        e.probability >= MIN_PROB &&
        e.source !== e.target && // skip self-loops for now
        e.target !== 'END', // hide synthetic END edges (or remove this line to show them)
    )
    .map((e, idx) => {
      const isFail =
        TERMINAL_FAIL.has(e.target) || e.probability < 0.25
      const isPositive =
        TERMINAL_SUCCESS.has(e.target) || e.probability >= 0.6

      const style = isFail ? fStyle : isPositive ? sStyle : pStyle
      const labelStyle = isFail ? fLbl : isPositive ? sLbl : pLbl

      const pctLabel = `${Math.round(e.probability * 100)}%`
      const dwellKey = `${e.source},${e.target}`
      const dwellSamples = data.transition_dwell[dwellKey] ?? []
      const avgDwellMin =
        dwellSamples.length > 0
          ? Math.round(
              dwellSamples.reduce((a, b) => a + b, 0) /
                dwellSamples.length /
                60,
            )
          : null

      const label = avgDwellMin != null
        ? `${pctLabel} · ~${avgDwellMin}m`
        : pctLabel

      return {
        id: `e${idx}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label,
        type: 'smoothstep',
        style,
        labelStyle,
        labelBgStyle: bg,
        labelBgPadding: pad,
        data: {
          probability: e.probability,
          count: e.count,
          timeStats: e.time_stats,
          dwellSamples,
        },
      }
    })
}

// ─── Tool enrichment ──────────────────────────────────────────────────────────
// The telemetry JSON doesn't carry tool-per-node info.
// Maintain this map manually (or add a tools field to your telemetry events).
// Keys should match your pipeline_nodes node_id strings.

export const TOOL_ENRICHMENT: Record<string, string[]> = {
  'prospect-research': ['LinkedIn', 'Salesforce', 'ZoomInfo'],
  'draft-outreach': ['Gmail', 'Notion'],
  'send-log': ['Gmail', 'Salesforce'],
  'follow-up': ['Outreach', 'Gmail', 'Salesforce'],
  'response-triage': ['Gmail', 'Salesforce', 'Slack'],
  'discovery-prep': ['Salesforce', 'Notion', 'Gong'],
  'discovery-call': ['Zoom', 'Gong', 'Calendly'],
}

// ─── Label formatter ──────────────────────────────────────────────────────────
// Converts "prospect-research" → "Prospect Research"

function formatLabel(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Main loader ──────────────────────────────────────────────────────────────

export interface LoadedMarkovData {
  nodes: Node[]
  edges: Edge[]
  raw: TransitionMatrixJSON
  // convenience stats for the summary cards
  stats: {
    nSequences: number
    nStates: number
    nTransitions: number
    topTransitions: TransitionMatrixJSON['top_transitions']
  }
}

let _cache: LoadedMarkovData | null = null

/**
 * Fetches and transforms transition_matrix.json.
 * Results are cached in memory — safe to call from multiple components.
 *
 * @param url  Override the default fetch URL (useful for testing or API swap)
 */
export async function loadMarkovData(url = DATA_URL): Promise<LoadedMarkovData> {
  if (_cache) return _cache

  console.log("Fetching Markov data from:", url)

  const res = await fetch(url)

  console.log("Fetch response:", res.status)

  if (!res.ok) throw new Error(`Failed to fetch markov data: ${res.statusText}`)

  const data: TransitionMatrixJSON = await res.json()

  console.log("Loaded JSON:", data)

  const nodes = buildNodes(data)
  const edges = buildEdges(data)

  console.log("Nodes built:", nodes.length)
  console.log("Edges built:", edges.length)

  const result: LoadedMarkovData = {
    nodes,
    edges,
    raw: data,
    stats: {
      nSequences: data.metadata.n_sequences,
      nStates: data.metadata.n_states,
      nTransitions: data.metadata.n_transitions_observed,
      topTransitions: data.top_transitions,
    },
  }

  _cache = result
  return result
}

/** Call this to bust the cache (e.g. after a new file upload) */
export function clearMarkovCache() {
  _cache = null
}
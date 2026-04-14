/**
 * dataLoader.ts
 * ─────────────
 * Transforms transition_matrix.json (output of markov_builder.py)
 * into React Flow Node[] and Edge[] for the workflow diagram.
 *
 * Layout:
 *   - Happy path nodes: vertical column at x=0
 *   - FAIL nodes: synthetic, positioned LEFT of their parent node
 *   - SUCCESS node: synthetic, positioned below the final pipeline node
 *   - Retry edges: exit and re-enter from the RIGHT handle
 *   - Fail edges: exit LEFT handle → enter RIGHT handle of FAIL node
 *   - Forward edges: exit BOTTOM → enter TOP
 */

import type { Node, Edge } from 'reactflow'
import type { TransitionMatrixJSON } from '../schema'

// Minimal shape of an all_tasks.json node we care about for display
interface AllTasksNode {
  node_id: string
  label: string
  app_cluster: string[]
  duration_distribution: { mean_minutes: number }
  automatable_fraction: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATIC_DATA_URL = '/data/transition_matrix.json'

function getDataUrl(projectId?: string): string {
  return projectId ? `/api/projects/${projectId}/markov` : STATIC_DATA_URL
}

// Known non-pipeline terminal node IDs (from explicit domain labelling).
// END is handled programmatically — not listed here.
const TERMINAL_SUCCESS = new Set(['qualified', 'closed-won'])
const TERMINAL_FAIL = new Set([
  'not-qualified', 'unsubscribed', 'cold', 'disqualified', 'no-show',
])

const Y_STEP = 220   // vertical gap between pipeline stages
const FAIL_X = -420  // FAIL nodes sit 420 px to the left of their parent

// ─── Fail descriptions ────────────────────────────────────────────────────────
// Surfaced as the label on each synthetic FAIL terminal node.

const FAIL_DESCRIPTIONS: Record<string, string> = {
  prospect_research:          'Cold lead / no fit',
  draft_outreach:             'No response to outreach',
  send_and_log:               'Bounced / unsubscribed',
  follow_up_sequence:         'Ghosted after follow-up',
  response_triage:            'Disqualified early',
  discovery_call_prep:        'Cancelled / no-show',
  discovery_call_execution:   'Not a fit',
  call_debrief_logging:       'Deal stalled post-discovery',
  stakeholder_mapping:        'No internal champion',
  demo_scheduling_and_prep:   'Unresponsive after scheduling',
  demo_delivery:              'Demo did not land',
  objection_handling:         'Could not overcome objections',
  proposal_drafting:          'Ghosted after proposal',
  contract_negotiation:       'Failed negotiation',
  deal_closure_and_handoff:   'Last-minute pull-out',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferAutomatable(avgMin: number): 'high' | 'medium' | 'low' {
  if (avgMin >= 30) return 'high'
  if (avgMin >= 10) return 'medium'
  return 'low'
}

/** "prospect_research" or "prospect-research" → "Prospect Research" */
function formatLabel(id: string): string {
  return id
    .replace(/_/g, '-')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Layout ───────────────────────────────────────────────────────────────────
// BFS topological sort — only called on pipeline nodes with forward edges.
// Depth → Y axis. Siblings at the same depth are centered on X=0.

import type { MarkovEdge } from '../schema'

function assignPositions(
  states: string[],
  edges: MarkovEdge[],
): Record<string, { x: number; y: number }> {
  const stateSet = new Set(states)
  const inDegree: Record<string, number> = {}
  const outEdges: Record<string, string[]> = {}

  for (const s of states) {
    inDegree[s] = 0
    outEdges[s] = []
  }

  for (const e of edges) {
    if (e.source === e.target) continue
    if (!stateSet.has(e.source) || !stateSet.has(e.target)) continue
    inDegree[e.target] = (inDegree[e.target] ?? 0) + 1
    outEdges[e.source].push(e.target)
  }

  const depth: Record<string, number> = {}
  const queue = states.filter((s) => (inDegree[s] ?? 0) === 0)
  queue.forEach((s) => (depth[s] = 0))

  while (queue.length) {
    const cur = queue.shift()!
    for (const nxt of outEdges[cur] ?? []) {
      depth[nxt] = Math.max(depth[nxt] ?? 0, (depth[cur] ?? 0) + 1)
      queue.push(nxt)
    }
  }

  // Group by depth level
  const cols: Record<number, string[]> = {}
  for (const s of states) {
    const d = depth[s] ?? 0
    cols[d] = cols[d] ?? []
    cols[d].push(s)
  }

  const X_STEP = 300
  const positions: Record<string, { x: number; y: number }> = {}

  for (const [col, nodeIds] of Object.entries(cols)) {
    const y = Number(col) * Y_STEP
    const totalWidth = (nodeIds.length - 1) * X_STEP
    nodeIds.forEach((id, idx) => {
      positions[id] = { x: idx * X_STEP - totalWidth / 2, y }
    })
  }

  return positions
}

// ─── Tool enrichment ──────────────────────────────────────────────────────────

export const TOOL_ENRICHMENT: Record<string, string[]> = {
  prospect_research:        ['LinkedIn', 'Salesforce', 'ZoomInfo'],
  draft_outreach:           ['Gmail', 'Notion'],
  send_and_log:             ['Gmail', 'Salesforce'],
  follow_up_sequence:       ['Outreach', 'Gmail', 'Salesforce'],
  response_triage:          ['Gmail', 'Salesforce', 'Slack'],
  discovery_call_prep:      ['Salesforce', 'Notion', 'Gong'],
  discovery_call_execution: ['Zoom', 'Gong', 'Calendly'],
}

// ─── Node builder ─────────────────────────────────────────────────────────────

interface BuiltNodes {
  nodes: Node[]
  finalNodeId: string   // deepest pipeline node — its END edge goes to SUCCESS
  positions: Record<string, { x: number; y: number }>
}

function buildNodes(data: TransitionMatrixJSON, tasksLookup?: Record<string, AllTasksNode>): BuiltNodes {
  const { states } = data.metadata

  // Identify pure pipeline nodes (exclude END and any known terminal labels)
  const pipelineStates = states.filter(
    (s) => s !== 'END' && !TERMINAL_SUCCESS.has(s) && !TERMINAL_FAIL.has(s),
  )

  // Forward edges only (no self-loops, no END-bound) for depth assignment
  const forwardEdges = data.edge_list.filter(
    (e) =>
      e.source !== e.target &&
      e.target !== 'END' &&
      !TERMINAL_FAIL.has(e.target) &&
      !TERMINAL_SUCCESS.has(e.target),
  )

  const positions = assignPositions(pipelineStates, forwardEdges)

  // Pipeline node that sits deepest in the BFS = last happy-path step
  let finalNodeId = pipelineStates[0] ?? 'END'
  let maxY = positions[finalNodeId]?.y ?? 0
  for (const id of pipelineStates) {
    const y = positions[id]?.y ?? 0
    if (y > maxY) { maxY = y; finalNodeId = id }
  }

  // Which pipeline nodes have an outgoing edge to END?
  const failExitSet = new Set(
    data.edge_list
      .filter((e) => e.target === 'END' && pipelineStates.includes(e.source))
      .map((e) => e.source),
  )

  const nodes: Node[] = []

  // ── Pipeline (task) nodes + their synthetic FAIL sibling ──────────────────
  for (const id of pipelineStates) {
    const pos = positions[id] ?? { x: 0, y: 0 }
    const durationSamples = (data.node_durations as Record<string, number[]>)[id] ?? []
    const avgMin =
      durationSamples.length > 0
        ? durationSamples.reduce((a, b) => a + b, 0) / durationSamples.length
        : 0

    // Overlay metadata from all_tasks.json if available, otherwise fall back
    // to transition-matrix derived values + hardcoded enrichment.
    const task = tasksLookup?.[id]
    const label      = task?.label ?? formatLabel(id)
    const tools      = task?.app_cluster?.length ? task.app_cluster : (TOOL_ENRICHMENT[id] ?? [])
    const minutes    = task ? Math.round(task.duration_distribution.mean_minutes) : Math.round(avgMin)
    const automatable = (task?.automatable_fraction as 'high' | 'medium' | 'low' | undefined)
                        ?? inferAutomatable(avgMin)

    nodes.push({
      id,
      type: 'taskNode',
      position: pos,
      data: {
        label,
        tools,
        minutes,
        automatable,
        durationSamples,
      },
    })

    // Synthetic FAIL terminal: same Y as parent, FAIL_X to the left
    if (failExitSet.has(id)) {
      nodes.push({
        id: `FAIL_${id}`,
        type: 'terminalNode',
        position: { x: pos.x + FAIL_X, y: pos.y },
        data: {
          label: FAIL_DESCRIPTIONS[id] ?? 'Deal lost',
          nodeType: 'fail',
        },
      })
    }
  }

  // ── Synthetic SUCCESS node at the bottom of the happy path ────────────────
  const successY = maxY + Y_STEP
  nodes.push({
    id: 'SUCCESS',
    type: 'terminalNode',
    position: { x: 0, y: successY },
    data: { label: 'Closed — Won', nodeType: 'success' },
  })

  return { nodes, finalNodeId, positions }
}

// ─── Edge builder ─────────────────────────────────────────────────────────────

function buildEdges(data: TransitionMatrixJSON, finalNodeId: string): Edge[] {
  const successStyle = { stroke: '#10B981', strokeWidth: 2.5 }
  const failStyle    = { stroke: '#EF4444', strokeWidth: 2.5 }
  const retryStyle   = { stroke: '#F59E0B', strokeWidth: 2.5 }
  const fwdStyle     = { stroke: '#5E149F', strokeWidth: 2.5 }

  const lbl = (color: string) => ({ fill: color, fontWeight: 700, fontSize: 13 })
  const bg  = { fill: '#111111', fillOpacity: 0.82 }
  const pad: [number, number] = [3, 7]

  // Nodes that should NOT be edge sources (they're terminal sinks)
  const terminalSources = new Set([...TERMINAL_SUCCESS, ...TERMINAL_FAIL, 'END'])

  const edges: Edge[] = []

  data.edge_list.forEach((e, idx) => {
    if (terminalSources.has(e.source)) return  // skip edges FROM terminals
    const pct = `${Math.round(e.probability * 100)}%`

    if (e.target === 'END') {
      if (e.source === finalNodeId) {
        // ── Final node → SUCCESS (bottom of happy path) ─────────────────────
        edges.push({
          id: `e${idx}-success`,
          source: e.source,
          target: 'SUCCESS',
          sourceHandle: 'bottom',
          targetHandle: 'top',
          label: pct,
          type: 'smoothstep',
          style: successStyle,
          labelStyle: lbl('#10B981'),
          labelBgStyle: bg,
          labelBgPadding: pad,
          data: { probability: e.probability, count: e.count },
        })
      } else {
        // ── Mid-pipeline → FAIL node (exits left) ───────────────────────────
        edges.push({
          id: `e${idx}-fail`,
          source: e.source,
          target: `FAIL_${e.source}`,
          sourceHandle: 'left-source',
          targetHandle: 'right',
          label: pct,
          type: 'smoothstep',
          style: failStyle,
          labelStyle: lbl('#EF4444'),
          labelBgStyle: bg,
          labelBgPadding: pad,
          data: { probability: e.probability, count: e.count },
        })
      }
      return
    }

    if (e.source === e.target) {
      // ── Retry / self-loop (exits and re-enters right) ────────────────────
      edges.push({
        id: `e${idx}-retry`,
        source: e.source,
        target: e.target,
        sourceHandle: 'right-source',
        targetHandle: 'right-target',
        label: pct,
        type: 'default',
        style: retryStyle,
        labelStyle: lbl('#F59E0B'),
        labelBgStyle: bg,
        labelBgPadding: pad,
        data: { probability: e.probability, count: e.count },
      })
      return
    }

    if (TERMINAL_FAIL.has(e.target) || TERMINAL_SUCCESS.has(e.target)) return  // skip explicit terminal edges

    // ── Normal forward edge (bottom → top) ───────────────────────────────────
    edges.push({
      id: `e${idx}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      label: pct,
      type: 'smoothstep',
      style: fwdStyle,
      labelStyle: lbl('#5E149F'),
      labelBgStyle: bg,
      labelBgPadding: pad,
      data: { probability: e.probability, count: e.count },
    })
  })

  return edges
}

// ─── Main loader ──────────────────────────────────────────────────────────────

export interface LoadedMarkovData {
  nodes: Node[]
  edges: Edge[]
  raw: TransitionMatrixJSON
  stats: {
    nSequences: number
    nStates: number
    nTransitions: number
    topTransitions: TransitionMatrixJSON['top_transitions']
  }
}

const _cache: Record<string, LoadedMarkovData> = {}

export async function loadMarkovData(projectId?: string): Promise<LoadedMarkovData> {
  const url = getDataUrl(projectId)
  if (_cache[url]) return _cache[url]

  // Fetch transition matrix (required) and all_tasks metadata (optional, project-only)
  const markovFetch = fetch(url)
  const tasksFetch = projectId
    ? fetch(`/api/projects/${projectId}/tasks`).then((r) => r.ok ? r.json() as Promise<AllTasksNode[]> : []).catch(() => [])
    : Promise.resolve([])

  const [res, tasksRaw] = await Promise.all([markovFetch, tasksFetch])
  if (!res.ok) throw new Error(`Failed to fetch markov data: ${res.statusText}`)

  const data: TransitionMatrixJSON = await res.json()

  // Build lookup: node_id → task metadata (only when we have real task data)
  const tasksLookup: Record<string, AllTasksNode> | undefined =
    tasksRaw.length > 0
      ? Object.fromEntries((tasksRaw as AllTasksNode[]).map((t) => [t.node_id, t]))
      : undefined

  const { nodes, finalNodeId } = buildNodes(data, tasksLookup)
  const edges = buildEdges(data, finalNodeId)

  const result: LoadedMarkovData = {
    nodes,
    edges,
    raw: data,
    stats: {
      nSequences: data.metadata.n_sequences,
      nStates:    data.metadata.n_states,
      nTransitions: data.metadata.n_transitions_observed,
      topTransitions: data.top_transitions,
    },
  }

  _cache[url] = result
  return result
}

export function clearMarkovCache(projectId?: string) {
  if (projectId) {
    delete _cache[getDataUrl(projectId)]
  } else {
    for (const key of Object.keys(_cache)) delete _cache[key]
  }
}

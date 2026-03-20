// ─── Types matching transition_matrix.json output from 02_markov_builder.py ──

export interface TimeStats {
  mean: number
  median: number
  std: number
  p90: number
  n: number
}

export interface MarkovEdge {
  source: string
  target: string
  probability: number
  count: number
  time_stats?: TimeStats
}

export interface MarkovSequenceStep {
  node: string
  timestamp: string
}

export interface MarkovSequence {
  deal: string
  outcome: string
  sequence: MarkovSequenceStep[]
}

export interface TopTransition {
  from: string
  to: string
  count: number
}

export interface MarkovGraphNode {
  target: string
  probability: number
  time_samples: number[]
}

export interface TransitionMatrixJSON {
  metadata: {
    states: string[]
    state_index: Record<string, number>
    n_states: number
    n_sequences: number
    n_transitions_observed: number
    non_zero_edges: number
    include_retries: boolean
    note: string
  }
  count_matrix: number[][]
  probability_matrix: number[][]
  // keys are node_id strings, values are arrays of duration_min samples
  node_durations: Record<string, number[]>
  // keys are "src,dst" strings
  transition_dwell: Record<string, number[]>
  edge_list: MarkovEdge[]
  sequences: MarkovSequence[]
  top_transitions: TopTransition[]
  graph: Record<string, MarkovGraphNode[]>
}
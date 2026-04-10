/**
 * Client-facing simulation records: each row is a tool-input / evaluation run.
 * Product model: the workspace dashboard is the baseline; each simulation stores
 * deltas (tool scenario + results) on top of that baseline — not a full copy.
 */
export interface ClientSimulation {
  id: string
  toolName: string
  status: 'completed' | 'running' | 'failed'
  timeSaved: string
  date: string
}

/** Seed list until API provides `/api/projects/:id/tools` + simulation history */
export const CLIENT_SIMULATIONS_SEED: ClientSimulation[] = [
  { id: 's1', toolName: 'Salesforce', status: 'completed', timeSaved: '~4.1 hrs/wk', date: '2026-03-22' },
  { id: 's2', toolName: 'Outreach', status: 'completed', timeSaved: '~2.3 hrs/wk', date: '2026-03-20' },
  { id: 's3', toolName: 'Gong.io', status: 'completed', timeSaved: '~1.8 hrs/wk', date: '2026-03-18' },
]

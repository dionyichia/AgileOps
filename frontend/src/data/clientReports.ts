import { CLIENT_SIMULATIONS_SEED } from './clientSimulations'

/** Recommendation report generated from a completed simulation run */
export interface ClientReport {
  id: string
  simulationId: string
  toolName: string
  generatedAt: string
  summaryLine: string
}

/** One report per seeded simulation until API provides history */
export const CLIENT_REPORTS_SEED: ClientReport[] = CLIENT_SIMULATIONS_SEED.map((sim) => ({
  id: `report-${sim.id}`,
  simulationId: sim.id,
  toolName: sim.toolName,
  generatedAt: sim.date,
  summaryLine: `ROI and adoption outlook for ${sim.toolName} based on your workflow simulation.`,
}))

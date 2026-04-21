import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import { CLIENT_SIMULATIONS_SEED, type ClientSimulation } from '../data/clientSimulations'

const statusBadge: Record<ClientSimulation['status'], string> = {
  completed: 'bg-sea-500/15 text-sea-300',
  running: 'bg-gold-500/15 text-gold-300',
  failed: 'bg-red-500/15 text-red-300',
}

export default function SimulationsList() {
  const navigate = useNavigate()

  const sorted = useMemo(
    () =>
      [...CLIENT_SIMULATIONS_SEED].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [],
  )

  return (
    <ClientWorkspaceShell
      headerLeft={
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/70 transition-colors hover:bg-black/[0.03]"
            aria-label="Back to dashboard"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black md:text-3xl">Simulations</h1>
            <p className="mt-1 text-sm text-black/55">
              Every entry is a tool you submitted for evaluation. Each run is a delta on your baseline
              workspace — not a separate full copy.
            </p>
          </div>
        </div>
      }
    >
      <main className="mx-auto max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-10">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-axispurple-900">
          All tool inputs ({sorted.length})
        </p>

        <ul className="space-y-3">
          {sorted.map((sim) => (
            <li key={sim.id}>
              <button
                type="button"
                onClick={() => navigate(`/simulation?eval=${encodeURIComponent(sim.id)}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-[var(--surface-page)] px-4 py-4 text-left transition-colors hover:border-black/15 hover:bg-[var(--surface-accent-subtle)]"
              >
                <div>
                  <div className="text-base font-semibold text-black">{sim.toolName}</div>
                  <div className="mt-0.5 text-xs text-black/45">
                    Submitted {new Date(sim.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-sm font-semibold text-sea-300">
                      <TrendingUp size={14} />
                      {sim.timeSaved}
                    </div>
                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusBadge[sim.status]}`}>
                      {sim.status}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-black/30" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </ClientWorkspaceShell>
  )
}

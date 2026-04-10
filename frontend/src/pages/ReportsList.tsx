import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import { CLIENT_REPORTS_SEED } from '../data/clientReports'

const VIOLET = '#5E149F'

export default function ReportsList() {
  const navigate = useNavigate()

  const sorted = useMemo(
    () =>
      [...CLIENT_REPORTS_SEED].sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
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
            <h1 className="text-2xl font-bold tracking-tight text-black md:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-black/55">
              Recommendations produced from your simulations. Open a report for the full readout.
            </p>
          </div>
        </div>
      }
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-8 md:px-10">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: VIOLET }}>
          All reports ({sorted.length})
        </p>

        <ul className="space-y-3">
          {sorted.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() =>
                  navigate(`/recommendation?eval=${encodeURIComponent(r.simulationId)}`)
                }
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-black/10 bg-[#FBFAFD] px-4 py-4 text-left transition-colors hover:border-black/15 hover:bg-[#F5F2FA]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(94,20,159,0.10)', color: VIOLET }}
                  >
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-black">{r.toolName}</div>
                    <div className="mt-0.5 text-xs text-black/45">
                      Generated{' '}
                      {new Date(r.generatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-black/55">{r.summaryLine}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-black/30" />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </ClientWorkspaceShell>
  )
}

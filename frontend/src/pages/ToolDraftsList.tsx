import { useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import { deleteToolDraft, loadToolDrafts, type ToolDraft } from '../lib/toolDraftStorage'

const VIOLET = '#5E149F'

export default function ToolDraftsList() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<ToolDraft[]>(() => loadToolDrafts())

  const sorted = useMemo(
    () => [...drafts].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()),
    [drafts],
  )

  const remove = (id: string, e: MouseEvent) => {
    e.stopPropagation()
    deleteToolDraft(id)
    setDrafts(loadToolDrafts())
  }

  const displayName = (d: ToolDraft) => d.toolName.trim() || 'Untitled tool'

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
            <h1 className="text-2xl font-bold tracking-tight text-black md:text-3xl">Tool Drafts</h1>
            <p className="mt-1 text-sm text-black/55">
              Saved tool inputs you haven&apos;t run yet. Open a draft to keep editing, or remove it from the list.
            </p>
          </div>
        </div>
      }
    >
      <main className="mx-auto max-w-3xl flex-1 px-6 py-8 md:px-10">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: VIOLET }}>
          All drafts ({sorted.length})
        </p>

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-[#FBFAFD] px-6 py-12 text-center text-sm text-black/50">
            No drafts yet. Use <span className="font-semibold text-black/70">Save Draft</span> on the tool input page.
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((d) => (
              <li key={d.id} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/toolinput?draft=${encodeURIComponent(d.id)}`)}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-2xl border border-black/10 bg-[#FBFAFD] px-4 py-4 text-left transition-colors hover:border-black/15 hover:bg-[#F5F2FA]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-black">{displayName(d)}</div>
                    <div className="mt-0.5 text-xs text-black/45">
                      Last saved{' '}
                      {new Date(d.savedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <ChevronRight size={18} className="ml-2 shrink-0 text-black/30" />
                </button>
                <button
                  type="button"
                  onClick={(e) => remove(d.id, e)}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 text-black/40 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete draft ${displayName(d)}`}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ClientWorkspaceShell>
  )
}

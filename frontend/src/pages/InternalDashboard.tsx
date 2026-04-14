import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  ChevronRight,
  FileText,
  GitBranch,
  Wrench,
  FlaskConical,
  FileBarChart,
  MessageSquareDashed,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Calendar,
  ArrowRight,
} from 'lucide-react'
import {
  projects as projectsApi,
  transcripts as transcriptsApi,
  pipeline as pipelineApi,
  type Project,
  type Transcript,
} from '../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  intake:       { label: 'Intake',        color: 'bg-slate-500/15 text-slate-400',       icon: Clock },
  transcripts:  { label: 'Transcripts',   color: 'bg-gold-500/15 text-gold-300',         icon: MessageSquareDashed },
  workflow:     { label: 'Workflow',       color: 'bg-cerulean-500/15 text-cerulean-300', icon: GitBranch },
  simulation:   { label: 'Simulation',    color: 'bg-magenta-500/15 text-magenta-300',   icon: FlaskConical },
  delivered:    { label: 'Delivered',      color: 'bg-sea-500/15 text-sea-300',           icon: CheckCircle2 },
}

const PROJECT_STEPS = [
  { key: 'transcripts',    label: 'Transcripts',    icon: MessageSquareDashed, path: 'transcripts',         description: 'Interview transcripts → task extraction' },
  { key: 'workflow',       label: 'Workflow Report', icon: GitBranch,           path: 'workflow-report',     description: 'Markov graph visualization' },
  { key: 'tool-input',     label: 'Tool Input',      icon: Wrench,              path: 'tool-input',          description: 'Tool evaluation setup' },
  { key: 'simulation',     label: 'Simulation',      icon: FlaskConical,        path: 'simulation/demo',     description: 'Monte Carlo results' },
  { key: 'recommendation', label: 'Recommendation',  icon: FileBarChart,        path: 'recommendation/demo', description: 'ROI readout' },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function InternalDashboard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  const [projectsList, setProjectsList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transcripts keyed by project id — fetched on first expand
  const [projectTranscripts, setProjectTranscripts] = useState<Record<string, Transcript[] | 'loading'>>({})

  // Track projects with a pipeline job running
  const [runningPipeline, setRunningPipeline] = useState<Set<string>>(new Set())

  useEffect(() => {
    projectsApi.listAll()
      .then(setProjectsList)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Fetch transcripts when a project is expanded for the first time
  useEffect(() => {
    if (!expandedProject) return
    if (projectTranscripts[expandedProject] !== undefined) return

    setProjectTranscripts(prev => ({ ...prev, [expandedProject]: 'loading' }))
    transcriptsApi.list(expandedProject)
      .then(ts => setProjectTranscripts(prev => ({ ...prev, [expandedProject]: ts })))
      .catch(() => setProjectTranscripts(prev => ({ ...prev, [expandedProject]: [] })))
  }, [expandedProject]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunPipeline = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (runningPipeline.has(projectId)) return
    setRunningPipeline(prev => new Set(prev).add(projectId))
    try {
      await pipelineApi.run(projectId)
    } catch (err) {
      console.error('Pipeline run failed:', err)
    } finally {
      setRunningPipeline(prev => { const s = new Set(prev); s.delete(projectId); return s })
    }
  }

  const filtered = projectsList.filter((p) =>
    p.company_name.toLowerCase().includes(search.toLowerCase()) ||
    p.team_name.toLowerCase().includes(search.toLowerCase()) ||
    p.primary_role.toLowerCase().includes(search.toLowerCase()),
  )

  const totalReps = projectsList.reduce((sum, p) => sum + (p.team_size ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#F7F4FB] flex flex-col text-black">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-black/8 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
            <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
            <span className="text-xs font-medium text-[#5E149F] bg-[#F4E8FB] px-2.5 py-1 rounded-full">INTERNAL</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/34" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects, contacts..."
                className="bg-[#F7F4FB] border border-black/10 focus:border-[#B4308B] focus:outline-none text-black placeholder:text-black/30 rounded-2xl pl-9 pr-4 py-2.5 text-sm w-72 transition-colors"
              />
            </div>
            <button className="flex items-center gap-2 text-white px-4 py-2.5 rounded-full font-semibold text-sm transition-colors" style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}>
              <Plus size={14} />
              New Project
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8">

        {/* Overview stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Total Projects</div>
            <div className="text-2xl font-bold text-black">{loading ? '—' : projectsList.length}</div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Active</div>
            <div className="text-2xl font-bold text-[#B4308B]">
              {loading ? '—' : projectsList.filter((p) => p.status !== 'delivered').length}
            </div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Delivered</div>
            <div className="text-2xl font-bold text-[#5E149F]">
              {loading ? '—' : projectsList.filter((p) => p.status === 'delivered').length}
            </div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Total Reps</div>
            <div className="text-2xl font-bold text-black">{loading ? '—' : totalReps}</div>
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Projects</h2>
            <span className="text-xs text-slate-600">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Loading / error / empty states */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              Loading projects…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-400 py-8">
              <AlertCircle size={16} />
              Failed to load projects: {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16 text-slate-500 text-sm">
              {search ? 'No projects match your search.' : 'No projects yet — create one to get started.'}
            </div>
          )}

          {filtered.map((project) => {
            const status = project.status ?? 'intake'
            const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['intake']
            const StatusIcon = statusCfg.icon
            const isExpanded = expandedProject === project.id
            const tsEntry = projectTranscripts[project.id]
            const transcriptList: Transcript[] = Array.isArray(tsEntry) ? tsEntry : []
            const tsLoading = tsEntry === 'loading'
            const initials = project.company_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)

            return (
              <div key={project.id} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
                {/* Project row */}
                <button
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-cerulean/20 border border-cerulean-500/20 flex items-center justify-center text-cerulean-300 text-sm font-bold">
                      {initials}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white">{project.company_name}</div>
                      <div className="text-xs text-slate-500">
                        {project.team_name} · {project.primary_role}
                        {project.team_size ? ` · ${project.team_size} reps` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right hidden md:block">
                      <div className="text-[10px] text-slate-600">
                        {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${statusCfg.color}`}>
                      <StatusIcon size={12} />
                      {statusCfg.label}
                    </span>
                    <ChevronRight size={16} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* ── Expanded detail ─────────────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-[#0B0F1E] animate-fade-in">
                    <div className="grid grid-cols-2 gap-px bg-slate-800">

                      {/* ── Left column: Project details ─────────────────────── */}
                      <div className="bg-[#0B0F1E] p-5 space-y-5">
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Project Details</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Users size={12} className="text-slate-500" />
                              <span className="text-slate-200 font-medium">{project.company_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <FileText size={12} className="text-slate-500" />
                              <span className="text-slate-400">{project.team_name} — {project.primary_role}</span>
                            </div>
                            {project.team_size && (
                              <div className="flex items-center gap-2 text-xs">
                                <Users size={12} className="text-slate-500" />
                                <span className="text-slate-400">{project.team_size} reps</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar size={12} className="text-slate-500" />
                              <span className="text-slate-400">
                                Started {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {project.notes && (
                          <div>
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Notes</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">{project.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* ── Right column: Transcripts ────────────────────────── */}
                      <div className="bg-[#0B0F1E] p-5 space-y-5">
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Transcripts {!tsLoading && `(${transcriptList.length})`}
                          </h4>
                          {tsLoading ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Loader2 size={12} className="animate-spin" /> Loading…
                            </div>
                          ) : transcriptList.length === 0 ? (
                            <p className="text-xs text-slate-600">No transcripts yet — schedule interviews</p>
                          ) : (
                            <div className="space-y-1.5">
                              {transcriptList.map((t) => (
                                <div key={t.id} className="flex items-center justify-between bg-[#111827] border border-slate-800 rounded-lg px-3 py-2">
                                  <div>
                                    <div className="text-xs font-medium text-slate-200">{t.interviewee_name}</div>
                                    <div className="text-[10px] text-slate-600">
                                      {t.interviewee_role} · {new Date(t.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                  {t.tasks_extracted != null && (
                                    <span className="text-[10px] font-medium text-sea-300 bg-sea-500/10 px-1.5 py-0.5 rounded">
                                      {t.tasks_extracted} tasks
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Bottom bar: navigation + actions ────────────────────── */}
                    <div className="border-t border-slate-800 px-5 py-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Jump to</div>
                      <div className="grid grid-cols-5 gap-2 mb-4">
                        {PROJECT_STEPS.map((step) => {
                          const StepIcon = step.icon
                          return (
                            <button
                              key={step.key}
                              onClick={() => navigate(`/projects/${project.id}/${step.path}`)}
                              className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/30 transition-all group"
                            >
                              <StepIcon size={16} className="text-slate-500 group-hover:text-cerulean-300 transition-colors" />
                              <span className="text-[10px] font-medium text-slate-400 group-hover:text-white transition-colors text-center">{step.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => navigate(`/projects/${project.id}/dashboard`)}
                          className="flex items-center gap-2 text-xs font-medium text-cerulean hover:text-cerulean-300 transition-colors"
                        >
                          <ArrowRight size={12} />
                          View Client Dashboard
                        </button>
                        <span className="text-slate-800">|</span>
                        <button
                          onClick={(e) => handleRunPipeline(e, project.id)}
                          disabled={runningPipeline.has(project.id)}
                          className="flex items-center gap-2 text-xs font-medium text-gold hover:text-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Loader2 size={12} className={runningPipeline.has(project.id) ? 'animate-spin' : ''} />
                          {runningPipeline.has(project.id) ? 'Running…' : 'Run Full Pipeline'}
                        </button>
                        <span className="text-slate-800">|</span>
                        <button
                          onClick={() => navigate(`/projects/${project.id}/transcripts`)}
                          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <AlertCircle size={12} />
                          Add Transcript
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

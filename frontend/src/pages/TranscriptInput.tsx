/**
 * TranscriptInput.tsx
 * ───────────────────
 * Internal frame for pasting interview transcripts and managing
 * the processing pipeline for a client project.
 *
 * See frontend/FRAMES.md — Frame 2 for full spec.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Send,
  Table2,
  Trash2,
  X,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react'
import {
  projects as projectsApi,
  transcripts as transcriptsApi,
  tasks as tasksApi,
  pipeline as pipelineApi,
  Project,
  Transcript,
  TaskNode,
} from '../api/client'
import { useJobProgress } from '../hooks/useJobProgress'
import { useGsapReveal } from '../hooks/useGsapReveal'

// ── Status badge component ──────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft:        { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'No transcripts' },
  processing:   { bg: 'bg-gold-500/10', text: 'text-gold-400', label: 'Processing' },
  ready:        { bg: 'bg-blue-500/10',  text: 'text-blue-400',  label: 'Ready to review' },
  shared:       { bg: 'bg-sea-500/10', text: 'text-sea-400', label: 'Shared with client' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  )
}

// ── Pipeline progress step ──────────────────────────────

interface PipelineStep {
  label: string
  pctRange: [number, number]
}

const PIPELINE_STAGES: PipelineStep[] = [
  { label: 'Generating synthetic telemetry', pctRange: [0, 30] },
  { label: 'Building Markov transition matrix', pctRange: [30, 60] },
  { label: 'Running Monte Carlo simulation', pctRange: [60, 100] },
]

function PipelineProgress({ progressPct, currentStep }: { progressPct: number; currentStep: string | null }) {
  return (
    <div className="space-y-3">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = progressPct >= stage.pctRange[1]
        const active = progressPct >= stage.pctRange[0] && progressPct < stage.pctRange[1]
        return (
          <div key={i} className="flex items-center gap-3">
            {done ? (
              <CheckCircle2 size={16} className="text-sea-400 flex-shrink-0" />
            ) : active ? (
              <Loader2 size={16} className="text-cerulean animate-spin flex-shrink-0" />
            ) : (
              <Circle size={16} className="text-slate-600 flex-shrink-0" />
            )}
            <span className={`text-sm ${done ? 'text-slate-300' : active ? 'text-cerulean-300' : 'text-slate-500'}`}>
              Stage {i + 1}/3: {stage.label}
            </span>
          </div>
        )
      })}
      {currentStep && (
        <p className="text-xs text-slate-500 ml-7">{currentStep}</p>
      )}
    </div>
  )
}

// ── Task preview modal ──────────────────────────────────

function TaskPreviewModal({ tasks, onClose }: { tasks: TaskNode[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#111827] border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold">Task Graph Preview ({tasks.length} nodes)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto flex-1 px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="pb-2 font-medium">Task</th>
                <th className="pb-2 font-medium">Tools</th>
                <th className="pb-2 font-medium">Avg Duration</th>
                <th className="pb-2 font-medium">Automatable</th>
                <th className="pb-2 font-medium">Sources</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.node_id} className="border-b border-slate-800/50">
                  <td className="py-3 pr-4">
                    <div className="text-white font-medium">{t.label}</div>
                    <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{t.description}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {t.app_cluster.map((app) => (
                        <span key={app} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-xs">
                          {app}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">
                    {t.duration_distribution.mean_minutes}m
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium ${
                      t.automatable_fraction === 'high' ? 'text-sea-400' :
                      t.automatable_fraction === 'medium' ? 'text-gold-400' : 'text-slate-400'
                    }`}>
                      {t.automatable_fraction}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500 text-xs">
                    {t.sources?.length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && (
            <p className="text-center py-8 text-slate-500">No tasks extracted yet. Submit a transcript to get started.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────

export default function TranscriptInput() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)

  // Project data
  const [project, setProject] = useState<Project | null>(null)
  const [transcriptList, setTranscriptList] = useState<Transcript[]>([])
  const [taskGraph, setTaskGraph] = useState<TaskNode[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Job tracking
  const [transcriptJobId, setTranscriptJobId] = useState<string | null>(null)
  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null)
  const transcriptJob = useJobProgress(transcriptJobId)
  const pipelineJob = useJobProgress(pipelineJobId)

  // UI state
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null)
  const [showTaskPreview, setShowTaskPreview] = useState(false)

  // ── Load project data ────────────────────────────────

  useEffect(() => {
    if (!projectId) return

    const load = async () => {
      try {
        const [proj, txList, taskList] = await Promise.all([
          projectsApi.get(projectId),
          transcriptsApi.list(projectId).catch(() => [] as Transcript[]),
          tasksApi.get(projectId).catch(() => [] as TaskNode[]),
        ])
        setProject(proj)
        setTranscriptList(txList)
        setTaskGraph(taskList)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load project')
      }
    }
    load()
  }, [projectId])

  // Refresh data when transcript job completes
  useEffect(() => {
    if (!projectId || !transcriptJob.isDone) return
    transcriptsApi.list(projectId).then(setTranscriptList).catch(() => {})
    tasksApi.get(projectId).then(setTaskGraph).catch(() => {})
    projectsApi.get(projectId).then(setProject).catch(() => {})
  }, [projectId, transcriptJob.isDone])

  // Refresh project when pipeline job completes
  useEffect(() => {
    if (!projectId || !pipelineJob.isDone) return
    projectsApi.get(projectId).then(setProject).catch(() => {})
  }, [projectId, pipelineJob.isDone])

  // ── Handlers ─────────────────────────────────────────

  const handleSubmitTranscript = async () => {
    if (!projectId || !name.trim() || !role.trim() || !text.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await transcriptsApi.submit(projectId, {
        interviewee_name: name.trim(),
        interviewee_role: role.trim(),
        interview_date: date,
        raw_text: text.trim(),
      })
      setTranscriptJobId(result.job_id)
      setName('')
      setRole('')
      setText('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit transcript')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRunPipeline = async () => {
    if (!projectId) return
    try {
      const result = await pipelineApi.run(projectId)
      setPipelineJobId(result.job_id)
      navigate(`/projects/${projectId}/dashboard`, { state: { pipelineJobId: result.job_id } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to start pipeline')
    }
  }

  const handleResetTasks = async () => {
    if (!projectId || !confirm('This will clear all extracted tasks. Are you sure?')) return
    try {
      await tasksApi.reset(projectId)
      setTaskGraph([])
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to reset tasks')
    }
  }

  const canSubmit = name.trim() && role.trim() && text.trim() && !submitting && !transcriptJob.isRunning
  const canRunPipeline = transcriptList.length > 0 && !pipelineJob.isRunning

  useGsapReveal(rootRef, [projectId, transcriptList.length, taskGraph.length, transcriptJob.isRunning, pipelineJob.isRunning], {
    selectors: ['[data-gsap-transcript]'],
    duration: 0.6,
    stagger: 0.1,
    y: 18,
    blur: 10,
  })

  // ── Render ───────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#F7F4FB] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{loadError}</p>
          <button onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')} className="text-[#5E149F] hover:opacity-70 text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-[#F7F4FB] flex flex-col text-black">
      {/* Header */}
      <header data-gsap-transcript className="border-b border-black/8 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src="/axis-logo.png"
                alt="Axis logo"
                className="h-11 w-11 rounded-2xl object-cover"
              />
              <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-black/44">
              <button onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')} className="hover:text-black transition-colors">Dashboard</button>
              <ChevronRight size={14} />
              <span className="text-black">{project?.company_name ?? 'Loading...'}</span>
            </div>
          </div>
          {project && <StatusBadge status={project.status} />}
        </div>
      </header>

      {/* Project summary */}
      <div data-gsap-transcript className="border-b border-black/6 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-[36px] leading-tight font-bold tracking-[-0.04em] text-black">
            {project?.company_name ?? 'Loading...'} — Transcript Input
          </h1>
          {project && (
            <p className="text-black/48 text-sm mt-1">
              {project.team_name} &middot; {project.primary_role}
              {project.team_size && ` &middot; ${project.team_size} employees`}
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <main data-gsap-transcript className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Left: Transcript form (3 cols) ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Form card */}
            <div className="bg-white border border-black/8 rounded-[24px] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-black font-semibold mb-4 flex items-center gap-2">
                <Plus size={16} className="text-[#5E149F]" />
                New Transcript
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-black/44 font-medium mb-1.5">Interviewee Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jordan Mills"
                    className="w-full bg-[#F7F4FB] border border-black/10 rounded-2xl px-3 py-2.5 text-black text-sm placeholder:text-black/28 focus:border-[#B4308B] focus:ring-1 focus:ring-[#B4308B]/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-black/44 font-medium mb-1.5">Interviewee Role *</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior SDR"
                    className="w-full bg-[#0B0F1E] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:border-cerulean focus:ring-1 focus:ring-cerulean/30 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-slate-400 font-medium mb-1.5">Interview Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-[#0B0F1E] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-cerulean focus:ring-1 focus:ring-cerulean/30 outline-none transition-colors"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs text-slate-400 font-medium mb-1.5">Transcript *</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the full call transcript here..."
                  rows={14}
                  className="w-full bg-[#0B0F1E] border border-slate-700 rounded-lg px-4 py-3 text-white text-sm font-mono leading-relaxed placeholder:text-slate-600 focus:border-cerulean focus:ring-1 focus:ring-cerulean/30 outline-none transition-colors resize-y"
                />
                <p className="text-xs text-slate-600 mt-1">{text.split(/\s+/).filter(Boolean).length} words</p>
              </div>

              {submitError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={14} />
                  {submitError}
                </div>
              )}

              <button
                onClick={handleSubmitTranscript}
                disabled={!canSubmit}
                className="flex items-center gap-2 bg-cerulean hover:bg-cerulean-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
              >
                {submitting || transcriptJob.isRunning ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {submitting ? 'Submitting...' : transcriptJob.isRunning ? 'Processing...' : 'Process Transcript'}
              </button>

              {/* Transcript job progress */}
              {transcriptJob.isRunning && transcriptJob.job && (
                <div className="mt-4 bg-cerulean-500/5 border border-cerulean-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 size={14} className="text-cerulean animate-spin" />
                    <span className="text-sm text-cerulean-300 font-medium">
                      {transcriptJob.job.current_step || 'Extracting tasks from transcript...'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cerulean rounded-full transition-all duration-500"
                      style={{ width: `${transcriptJob.job.progress_pct}%` }}
                    />
                  </div>
                </div>
              )}

              {transcriptJob.isDone && (
                <div className="mt-4 bg-sea-500/10 border border-sea-500/20 rounded-lg px-4 py-3 text-sea-400 text-sm flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Transcript processed successfully
                </div>
              )}

              {transcriptJob.isFailed && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={14} />
                  {transcriptJob.error}
                  <button
                    onClick={() => setTranscriptJobId(null)}
                    className="ml-auto text-red-300 hover:text-white text-xs underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Transcript history */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <FileText size={16} className="text-cerulean" />
                Transcript History
                {transcriptList.length > 0 && (
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    {transcriptList.length}
                  </span>
                )}
              </h2>

              {transcriptList.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">
                  No transcripts submitted yet. Paste your first interview above.
                </p>
              ) : (
                <div className="space-y-2">
                  {transcriptList.map((tx) => {
                    const expanded = expandedTranscript === tx.id
                    return (
                      <div key={tx.id} className="border border-slate-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedTranscript(expanded ? null : tx.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors text-left"
                        >
                          <ChevronDown
                            size={14}
                            className={`text-slate-500 transition-transform flex-shrink-0 ${expanded ? '' : '-rotate-90'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white font-medium">{tx.interviewee_name}</span>
                            <span className="text-xs text-slate-500 ml-2">{tx.interviewee_role}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                            {tx.tasks_extracted != null && (
                              <span className="text-sea-400">+{tx.tasks_extracted} tasks</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(tx.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 border-t border-slate-800">
                            <pre className="mt-3 text-xs text-slate-400 font-mono leading-relaxed max-h-60 overflow-auto whitespace-pre-wrap">
                              {tx.raw_text}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Pipeline actions + task preview (2 cols) ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pipeline actions */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Play size={16} className="text-cerulean" />
                Pipeline Actions
              </h2>

              <div className="space-y-3">
                {/* Run full pipeline */}
                <button
                  onClick={handleRunPipeline}
                  disabled={!canRunPipeline}
                  className="w-full flex items-center gap-3 bg-cerulean/10 hover:bg-cerulean/20 disabled:bg-slate-800/50 disabled:cursor-not-allowed border border-cerulean-500/20 disabled:border-slate-700 rounded-xl px-4 py-3 transition-colors text-left"
                >
                  {pipelineJob.isRunning ? (
                    <Loader2 size={18} className="text-cerulean animate-spin flex-shrink-0" />
                  ) : (
                    <Play size={18} className={canRunPipeline ? 'text-cerulean' : 'text-slate-600'} />
                  )}
                  <div>
                    <div className={`text-sm font-medium ${canRunPipeline ? 'text-white' : 'text-slate-500'}`}>
                      Visualise Workflow
                    </div>
                  </div>
                </button>

                {/* Pipeline progress */}
                {pipelineJob.isRunning && pipelineJob.job && (
                  <div className="bg-cerulean-500/5 border border-cerulean-500/20 rounded-xl p-4">
                    <PipelineProgress
                      progressPct={pipelineJob.job.progress_pct}
                      currentStep={pipelineJob.job.current_step}
                    />
                    <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cerulean rounded-full transition-all duration-500"
                        style={{ width: `${pipelineJob.job.progress_pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {pipelineJob.isDone && (
                  <div className="bg-sea-500/10 border border-sea-500/20 rounded-xl px-4 py-3 text-sea-400 text-sm flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Pipeline complete — ready to review
                  </div>
                )}

                {pipelineJob.isFailed && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} />
                      Pipeline failed
                    </div>
                    <p className="text-xs mt-1">{pipelineJob.error}</p>
                  </div>
                )}

                {/* Preview tasks */}
                <button
                  onClick={() => setShowTaskPreview(true)}
                  className="w-full flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 transition-colors text-left"
                >
                  <Table2 size={18} className="text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-white">Preview Tasks</div>
                    <div className="text-xs text-slate-500">
                      {taskGraph.length} nodes in task graph
                    </div>
                  </div>
                </button>

                {/* Reset tasks */}
                <button
                  onClick={handleResetTasks}
                  disabled={taskGraph.length === 0}
                  className="w-full flex items-center gap-3 bg-slate-800/30 hover:bg-red-500/10 disabled:cursor-not-allowed border border-slate-700 hover:border-red-500/30 disabled:hover:border-slate-700 rounded-xl px-4 py-3 transition-colors text-left group"
                >
                  <Trash2 size={18} className="text-slate-500 group-hover:text-red-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-400 group-hover:text-red-300">Reset Tasks</div>
                    <div className="text-xs text-slate-600">Clear all extracted tasks</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Project Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Transcripts</span>
                  <span className="text-sm text-white font-medium">{transcriptList.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Task Nodes</span>
                  <span className="text-sm text-white font-medium">{taskGraph.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Status</span>
                  {project && <StatusBadge status={project.status} />}
                </div>
              </div>

              {project?.status === 'ready' && (
                <button
                  onClick={() => navigate(`/projects/${projectId}/workflow-report`)}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-cerulean hover:bg-cerulean-400 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                >
                  View Report
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0B0F1E] sticky bottom-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </footer>

      {/* Task preview modal */}
      {showTaskPreview && (
        <TaskPreviewModal tasks={taskGraph} onClose={() => setShowTaskPreview(false)} />
      )}
    </div>
  )
}

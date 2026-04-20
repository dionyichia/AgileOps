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
  Send,
  Table2,
  Trash2,
  X,
  CheckCircle2,
  Circle,
  AlertCircle,
  Check,
  Pencil,
  Save,
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
  { label: 'Generating synthetic telemetry ~15s', pctRange: [0, 30] },
  { label: 'Building workflow graph ~20s', pctRange: [30, 60] },
  { label: 'Running Monte Carlo simulation ~30-60s', pctRange: [60, 100] },
]

const TRANSCRIPT_STEP_LABELS: Record<string, string> = {
  'Reading transcript': 'Reading transcript... ~5s',
  'Sending to Claude for extraction': 'Extracting tasks with Claude... ~30-60s',
  'Updating task graph': 'Updating task graph... ~5s',
  Done: 'Transcript complete',
}

interface EditableTaskDraft {
  label: string
  tools: string
  mean_minutes: number
  automatable_fraction: TaskNode['automatable_fraction']
  role_type: string
  workflow_type: string
}

function toTaskDraft(task: TaskNode): EditableTaskDraft {
  return {
    label: task.label,
    tools: task.app_cluster.join(', '),
    mean_minutes: task.duration_distribution.mean_minutes,
    automatable_fraction: task.automatable_fraction,
    role_type: task.role_type ?? '',
    workflow_type: task.workflow_type ?? '',
  }
}

function PipelineProgress({ progressPct, currentStep }: { progressPct: number; currentStep: string | null }) {
  return (
    <div className="space-y-3">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = progressPct >= stage.pctRange[1]
        const active = progressPct >= stage.pctRange[0] && progressPct < stage.pctRange[1]
        return (
          <div key={i} className="flex items-center gap-3">
            {done ? (
              <CheckCircle2 size={16} className="text-[#248F63] flex-shrink-0" />
            ) : active ? (
              <Loader2 size={16} className="text-[#5E149F] animate-spin flex-shrink-0" />
            ) : (
              <Circle size={16} className="text-black/28 flex-shrink-0" />
            )}
            <span className={`text-sm ${done ? 'text-black/52' : active ? 'text-[#5E149F]' : 'text-black/36'}`}>
              Stage {i + 1}/3: {stage.label}
            </span>
          </div>
        )
      })}
      {currentStep && (
        <p className="text-xs text-black/40 ml-7">{currentStep}</p>
      )}
    </div>
  )
}

// ── Task preview modal ──────────────────────────────────

function TaskPreviewModal({
  tasks,
  onClose,
  onSaveTask,
}: {
  tasks: TaskNode[]
  onClose: () => void
  onSaveTask: (nodeId: string, draft: EditableTaskDraft) => Promise<TaskNode[]>
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(tasks.slice(0, 5).map((task) => task.node_id)))
  const [drafts, setDrafts] = useState<Record<string, EditableTaskDraft>>(() =>
    Object.fromEntries(tasks.map((task) => [task.node_id, toTaskDraft(task)])),
  )
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string | null>>({})
  const [saveSuccessIds, setSaveSuccessIds] = useState<Record<string, boolean>>({})

  const toggleExpanded = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const handleDraftChange = (nodeId: string, patch: Partial<EditableTaskDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...patch },
    }))
    setSaveErrors((prev) => ({ ...prev, [nodeId]: null }))
    setSaveSuccessIds((prev) => ({ ...prev, [nodeId]: false }))
  }

  const handleSaveTask = async (nodeId: string) => {
    const draft = drafts[nodeId]
    if (!draft) return
    setSavingIds((prev) => ({ ...prev, [nodeId]: true }))
    setSaveErrors((prev) => ({ ...prev, [nodeId]: null }))
    setSaveSuccessIds((prev) => ({ ...prev, [nodeId]: false }))

    try {
      const updatedTasks = await onSaveTask(nodeId, draft)
      const updatedTask = updatedTasks.find((task) => task.node_id === nodeId)
      if (updatedTask) {
        setDrafts((prev) => ({ ...prev, [nodeId]: toTaskDraft(updatedTask) }))
      }
      setSaveSuccessIds((prev) => ({ ...prev, [nodeId]: true }))
      window.setTimeout(() => {
        setSaveSuccessIds((prev) => ({ ...prev, [nodeId]: false }))
      }, 1600)
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [nodeId]: err instanceof Error ? err.message : 'Failed to save task',
      }))
    } finally {
      setSavingIds((prev) => ({ ...prev, [nodeId]: false }))
    }
  }

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
          <div className="space-y-3">
            {tasks.map((task, index) => {
              const expanded = expandedIds.has(task.node_id)
              const draft = drafts[task.node_id] ?? toTaskDraft(task)
              const isSaving = !!savingIds[task.node_id]
              const saveError = saveErrors[task.node_id]
              const isSaved = !!saveSuccessIds[task.node_id]

              return (
                <div key={task.node_id} className="rounded-2xl border border-slate-800 bg-[#0B1220] overflow-hidden">
                  <button
                    onClick={() => toggleExpanded(task.node_id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Task {index + 1}</span>
                        <span className="text-[10px] text-slate-600">{task.sources?.length ?? 0} sources</span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-white truncate">{draft.label}</div>
                      <div className="mt-1 text-xs text-slate-500 line-clamp-2">{task.description}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {isSaved && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                          <Check size={12} />
                          Saved
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{expanded ? 'Collapse' : 'Expand'}</span>
                      <ChevronRight size={14} className={`text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-800 px-4 py-4 space-y-4">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Step Name</label>
                          <input
                            value={draft.label}
                            onChange={(e) => handleDraftChange(task.node_id, { label: e.target.value })}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B4308B]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Tools Used</label>
                          <input
                            value={draft.tools}
                            onChange={(e) => handleDraftChange(task.node_id, { tools: e.target.value })}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B4308B]"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Avg Duration (min)</label>
                          <input
                            type="number"
                            min={1}
                            value={draft.mean_minutes}
                            onChange={(e) => handleDraftChange(task.node_id, { mean_minutes: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B4308B]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Automation Potential</label>
                          <select
                            value={draft.automatable_fraction}
                            onChange={(e) => handleDraftChange(task.node_id, { automatable_fraction: e.target.value as TaskNode['automatable_fraction'] })}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B4308B]"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Role Type</label>
                          <input
                            value={draft.role_type}
                            onChange={(e) => handleDraftChange(task.node_id, { role_type: e.target.value })}
                            placeholder="e.g. SDR, AE, CSM"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B4308B]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Workflow Type</label>
                          <input
                            value={draft.workflow_type}
                            onChange={(e) => handleDraftChange(task.node_id, { workflow_type: e.target.value })}
                            placeholder="e.g. outbound, closing"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B4308B]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <Pencil size={12} />
                          Admin edits save directly to this project's task graph.
                        </div>
                        <button
                          onClick={() => handleSaveTask(task.node_id)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          {isSaving ? 'Saving...' : 'Save Task'}
                        </button>
                      </div>

                      {saveError && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {saveError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
  const [teamSizeDraft, setTeamSizeDraft] = useState('')
  const [teamSizeSaving, setTeamSizeSaving] = useState(false)
  const transcriptFormLocked = submitting || transcriptJob.isRunning

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
        setTeamSizeDraft(proj.team_size != null ? String(proj.team_size) : '')
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
    setName('')
    setRole('')
    setText('')
  }, [projectId, transcriptJob.isDone])

  // Refresh project when pipeline job completes
  useEffect(() => {
    if (!projectId || !pipelineJob.isDone) return
    projectsApi.get(projectId).then(setProject).catch(() => {})
    navigate(`/projects/${projectId}/dashboard`, { state: { pipelineJobId } })
  }, [navigate, pipelineJob.isDone, pipelineJobId, projectId])

  const getTranscriptStepLabel = (step: string | null | undefined) => {
    if (!step) return 'Extracting tasks with Claude... ~30-60s'
    return TRANSCRIPT_STEP_LABELS[step] ?? step
  }

  const handleSaveTaskPreviewEdit = async (nodeId: string, draft: EditableTaskDraft) => {
    if (!projectId) return taskGraph
    const updatedTasks = taskGraph.map((task) => {
      if (task.node_id !== nodeId) return task
      return {
        ...task,
        label: draft.label.trim(),
        app_cluster: draft.tools.split(',').map((item) => item.trim()).filter(Boolean),
        duration_distribution: {
          ...task.duration_distribution,
          mean_minutes: draft.mean_minutes,
        },
        automatable_fraction: draft.automatable_fraction,
        role_type: draft.role_type.trim() || undefined,
        workflow_type: draft.workflow_type.trim() || undefined,
      }
    })
    const savedTasks = await tasksApi.update(projectId, updatedTasks)
    setTaskGraph(savedTasks)
    return savedTasks
  }

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

  const handleSaveTeamSize = async () => {
    if (!projectId) return
    const parsed = parseInt(teamSizeDraft, 10)
    if (isNaN(parsed) || parsed <= 0) return
    setTeamSizeSaving(true)
    try {
      const updated = await projectsApi.update(projectId, { team_size: parsed })
      setProject(updated)
    } catch {
      // silent — not critical
    } finally {
      setTeamSizeSaving(false)
    }
  }

  const canSubmit = name.trim() && role.trim() && text.trim() && !transcriptFormLocked
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
                    disabled={transcriptFormLocked}
                    placeholder="e.g. Jordan Mills"
                    className="w-full bg-[#F7F4FB] border border-black/10 rounded-2xl px-3 py-2.5 text-black text-sm placeholder:text-black/28 focus:border-[#B4308B] focus:ring-1 focus:ring-[#B4308B]/20 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-black/44 font-medium mb-1.5">Interviewee Role *</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={transcriptFormLocked}
                    placeholder="e.g. Senior SDR"
                    className="w-full bg-[#F7F4FB] border border-black/10 rounded-2xl px-3 py-2.5 text-black text-sm placeholder:text-black/28 focus:border-[#B4308B] focus:ring-1 focus:ring-[#B4308B]/20 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-black/44 font-medium mb-1.5">Interview Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={transcriptFormLocked}
                  className="bg-[#F7F4FB] border border-black/10 rounded-2xl px-3 py-2.5 text-black text-sm focus:border-[#B4308B] focus:ring-1 focus:ring-[#B4308B]/20 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs text-black/44 font-medium mb-1.5">Transcript *</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={transcriptFormLocked}
                  placeholder="Paste the full call transcript here..."
                  rows={14}
                  className="w-full bg-[#F7F4FB] border border-black/10 rounded-2xl px-4 py-3 text-black text-sm font-mono leading-relaxed placeholder:text-black/28 focus:border-[#B4308B] focus:ring-1 focus:ring-[#B4308B]/20 outline-none transition-colors resize-y disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 disabled:bg-black/10 disabled:text-black/30 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
                style={canSubmit ? { background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)', boxShadow: '0 10px 24px rgba(94,20,159,0.18)' } : undefined}
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
                <div className="mt-4 bg-[#F7F4FB] border border-black/8 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 size={14} className="text-[#5E149F] animate-spin" />
                    <span className="text-sm text-black/72 font-medium">
                      {getTranscriptStepLabel(transcriptJob.job.current_step)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${transcriptJob.job.progress_pct}%`, background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
                    />
                  </div>
                </div>
              )}

              {transcriptJob.isDone && (
                <div className="mt-4 bg-[#F0FAF5] border border-[#248F63]/20 rounded-2xl px-4 py-3 text-[#248F63] text-sm flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Transcript processed successfully
                </div>
              )}

              {transcriptJob.isFailed && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-500 text-sm flex items-center gap-2">
                  <AlertCircle size={14} />
                  {transcriptJob.error}
                  <button
                    onClick={() => setTranscriptJobId(null)}
                    className="ml-auto text-red-400 hover:text-red-600 text-xs underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Transcript history */}
            <div className="bg-white border border-black/8 rounded-2xl p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-black font-semibold mb-4 flex items-center gap-2">
                <FileText size={16} className="text-[#5E149F]" />
                Transcript History
                {transcriptList.length > 0 && (
                  <span className="text-xs bg-[#F4E8FB] text-[#5E149F] px-2 py-0.5 rounded-full">
                    {transcriptList.length}
                  </span>
                )}
              </h2>

              {transcriptList.length === 0 ? (
                <p className="text-black/40 text-sm text-center py-6">
                  No transcripts submitted yet. Paste your first interview above.
                </p>
              ) : (
                <div className="space-y-2">
                  {transcriptList.map((tx) => {
                    const expanded = expandedTranscript === tx.id
                    return (
                      <div key={tx.id} className="border border-black/8 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedTranscript(expanded ? null : tx.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F7F4FB] transition-colors text-left"
                        >
                          <ChevronDown
                            size={14}
                            className={`text-black/32 transition-transform flex-shrink-0 ${expanded ? '' : '-rotate-90'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-black font-medium">{tx.interviewee_name}</span>
                            <span className="text-xs text-black/42 ml-2">{tx.interviewee_role}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-black/42 flex-shrink-0">
                            {tx.tasks_extracted != null && (
                              <span className="text-[#248F63] font-medium">+{tx.tasks_extracted} tasks</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(tx.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 border-t border-black/8">
                            <pre className="mt-3 text-xs text-black/52 font-mono leading-relaxed max-h-60 overflow-auto whitespace-pre-wrap">
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
            <div className="bg-white border border-black/8 rounded-2xl p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-black font-semibold mb-4 flex items-center gap-2">
                <Play size={16} className="text-[#5E149F]" />
                Pipeline Actions
              </h2>

              <div className="space-y-3">
                {/* Run full pipeline */}
                <button
                  onClick={handleRunPipeline}
                  disabled={!canRunPipeline}
                  className="w-full flex items-center gap-3 disabled:bg-black/[0.03] disabled:cursor-not-allowed border border-black/8 disabled:border-black/8 rounded-xl px-4 py-3 transition-colors text-left"
                  style={canRunPipeline ? { background: 'rgba(94,20,159,0.06)', borderColor: 'rgba(94,20,159,0.18)' } : undefined}
                >
                  {pipelineJob.isRunning ? (
                    <Loader2 size={18} className="text-[#5E149F] animate-spin flex-shrink-0" />
                  ) : (
                    <Play size={18} className={canRunPipeline ? 'text-[#5E149F]' : 'text-black/28'} />
                  )}
                  <div>
                    <div className={`text-sm font-medium ${canRunPipeline ? 'text-black' : 'text-black/38'}`}>
                      Generate Workflow
                    </div>
                  </div>
                </button>

                {/* Pipeline progress */}
                {pipelineJob.isRunning && pipelineJob.job && (
                  <div className="bg-[#F7F4FB] border border-black/8 rounded-xl p-4">
                    <PipelineProgress
                      progressPct={pipelineJob.job.progress_pct}
                      currentStep={pipelineJob.job.current_step}
                    />
                    <div className="mt-3 h-1.5 bg-black/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pipelineJob.job.progress_pct}%`, background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
                      />
                    </div>
                  </div>
                )}

                {pipelineJob.isDone && (
                  <div className="bg-[#F0FAF5] border border-[#248F63]/20 rounded-xl px-4 py-3 text-[#248F63] text-sm flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Pipeline complete — ready to review
                  </div>
                )}

                {pipelineJob.isFailed && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-500 text-sm">
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
                  className="w-full flex items-center gap-3 bg-[#F7F4FB] hover:bg-[#F0EAF8] border border-black/8 rounded-xl px-4 py-3 transition-colors text-left"
                >
                  <Table2 size={18} className="text-black/42 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-black">Preview Tasks</div>
                    <div className="text-xs text-black/42">
                      {taskGraph.length} nodes in task graph
                    </div>
                  </div>
                </button>

                {/* Reset tasks */}
                <button
                  onClick={handleResetTasks}
                  disabled={taskGraph.length === 0}
                  className="w-full flex items-center gap-3 bg-[#F7F4FB] hover:bg-red-50 disabled:cursor-not-allowed border border-black/8 hover:border-red-200 disabled:hover:border-black/8 rounded-xl px-4 py-3 transition-colors text-left group"
                >
                  <Trash2 size={18} className="text-black/32 group-hover:text-red-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-black/52 group-hover:text-red-500">Reset Tasks</div>
                    <div className="text-xs text-black/32">Clear all extracted tasks</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-white border border-black/8 rounded-2xl p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <h3 className="text-sm font-semibold text-black mb-4">Project Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black/52">Transcripts</span>
                  <span className="text-sm text-black font-medium">{transcriptList.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black/52">Task Nodes</span>
                  <span className="text-sm text-black font-medium">{taskGraph.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black/52">Status</span>
                  {project && <StatusBadge status={project.status} />}
                </div>
                <div className="pt-2 border-t border-black/8">
                  <label className="block text-xs text-black/44 font-medium mb-1.5">Team Size</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={teamSizeDraft}
                      onChange={(e) => setTeamSizeDraft(e.target.value)}
                      onBlur={handleSaveTeamSize}
                      placeholder="e.g. 12"
                      className="w-full bg-[#F7F4FB] border border-black/10 rounded-xl px-3 py-2 text-black text-sm placeholder:text-black/28 focus:border-[#B4308B] focus:ring-1 focus:ring-[#B4308B]/20 outline-none transition-colors"
                    />
                    {teamSizeSaving && <Loader2 size={16} className="text-black/30 animate-spin self-center flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-black/36 mt-1">Used in pipeline simulations</p>
                </div>
              </div>

              {project?.status === 'ready' && (
                <button
                  onClick={() => navigate(`/projects/${projectId}/workflow-report`)}
                  className="w-full mt-4 flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-full font-semibold text-sm transition-colors"
                  style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
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
      <footer className="border-t border-black/8 bg-white/95 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')}
            className="flex items-center gap-2 text-black/50 hover:text-black text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </footer>

      {/* Task preview modal */}
      {showTaskPreview && (
        <TaskPreviewModal tasks={taskGraph} onClose={() => setShowTaskPreview(false)} onSaveTask={handleSaveTaskPreviewEdit} />
      )}
    </div>
  )
}

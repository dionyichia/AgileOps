import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMarkovData } from '../hooks/pullMarkovData'
import { clearMarkovCache } from '../hooks/dataLoader'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { toolEvals as toolEvalsApi, projects as projectsApi, recommendation as recommendationApi, tasks as tasksApi } from '../api/client'
import type { ToolEvaluation, Project, RecommendationData, TaskNode as ApiTaskNode } from '../api/client'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Users,
  Clock,
  Layers,
  Play,
  BarChart3,
  MessageSquare,
  X,
  Send,
  ChevronRight,
  TrendingUp,
  Plus,
  LayoutDashboard,
  FileText,
  GitBranch,
  Zap,
  Award,
  Pencil,
  Check,
  AlertCircle,
} from 'lucide-react'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { roleStats as mockRoleStats, toolBuckets, type Tool } from '../data/mockData'

// ── Types ────────────────────────────────────────────────────────────────────

interface NodeComment {
  id: string
  text: string
  createdAt: string
}

const statusBadge: Record<string, string> = {
  completed: 'bg-sea-500/15 text-sea-300',
  running:   'bg-gold-500/15 text-gold-300',
  failed:    'bg-red-500/15 text-red-300',
}

const bucketColorMap: Record<string, string> = {
  indigo:  'bg-cerulean-500/15 text-cerulean-300 border-cerulean-500/30',
  violet:  'bg-magenta-500/15 text-magenta-300 border-magenta-500/30',
  cyan:    'bg-cerulean-500/15 text-cerulean-200 border-cerulean-500/30',
  emerald: 'bg-sea-500/15 text-sea-300 border-sea-500/30',
  amber:   'bg-gold-500/15 text-gold-300 border-gold-500/30',
  rose:    'bg-magenta-500/15 text-magenta-200 border-magenta-500/30',
}

const BRAND = {
  shell: '#F7F4FB',
  panel: '#FFFFFF',
  border: 'rgba(94, 20, 159, 0.10)',
  text: '#111111',
  muted: 'rgba(17, 17, 17, 0.52)',
  violet: '#5E149F',
  orchid: '#B4308B',
  pink: '#E2409B',
  coral: '#F75A8C',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId?: string }>()

  const [markovRefreshKey, setMarkovRefreshKey] = useState(0)
  const { existingNodes, existingEdges, loading: markovLoading, error: markovError, isRealData, stats: markovStats } =
    useMarkovData(projectId, markovRefreshKey)
  const isAdmin = useIsAdmin()
  const [apiProject, setApiProject] = useState<Project | null>(null)
  const [apiToolEvals, setApiToolEvals] = useState<ToolEvaluation[] | null>(null)
  const [hasTaskData, setHasTaskData] = useState(false)

  useEffect(() => {
    if (!projectId) return
    projectsApi.get(projectId).then(setApiProject).catch(() => {})
    toolEvalsApi.list(projectId).then(setApiToolEvals).catch(() => {})
    // Check whether all_tasks.json exists (independent of pipeline status)
    tasksApi.get(projectId)
      .then((nodes) => setHasTaskData(nodes.length > 0))
      .catch(() => setHasTaskData(false))
  }, [projectId, markovRefreshKey])

  const roleStats = apiProject
    ? {
        ...mockRoleStats,
        company: apiProject.company_name,
        primaryRole: apiProject.primary_role,
        teamSize: apiProject.team_size ?? mockRoleStats.numEmployees,
        numEmployees: apiProject.team_size ?? mockRoleStats.numEmployees,
      }
    : mockRoleStats

  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  // Two fixed tabs: workspace | report
  const [activeTab, setActiveTab] = useState<"workspace" | "report">("workspace")
  const [reportRec, setReportRec] = useState<RecommendationData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Fetch recommendation for the most recent tool eval when report tab is activated
  useEffect(() => {
    if (activeTab !== "report" || !projectId || !apiToolEvals?.length) return
    const latestEval = apiToolEvals[0]
    setReportLoading(true)
    recommendationApi.get(projectId, latestEval.id)
      .then(setReportRec)
      .catch(() => setReportRec(null))
      .finally(() => setReportLoading(false))
  }, [activeTab, projectId, apiToolEvals])

  const focusSimulationTab = useCallback((_simId: string) => {
    setActiveTab("report")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])


  // ── Edit mode state ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [rawTasks, setRawTasks] = useState<ApiTaskNode[]>([])
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{
    label: string
    tools: string
    mean_minutes: number
    automatable_fraction: string
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editSaveError, setEditSaveError] = useState<string | null>(null)
  const [editDirty, setEditDirty] = useState(false)

  const toggleEditMode = useCallback(async () => {
    if (editMode) {
      setEditMode(false)
      setEditingNodeId(null)
      setEditDraft(null)
      return
    }
    // Load raw tasks when entering edit mode
    if (projectId) {
      try {
        const fetched = await tasksApi.get(projectId)
        setRawTasks(fetched)
      } catch {
        setRawTasks([])
      }
    }
    setEditMode(true)
  }, [editMode, projectId])

  const handleOpenEdit = useCallback((nodeId: string) => {
    const task = rawTasks.find((t) => t.node_id === nodeId)
    if (!task) return
    setEditingNodeId(nodeId)
    setEditDraft({
      label: task.label,
      tools: task.app_cluster.join(', '),
      mean_minutes: task.duration_distribution.mean_minutes,
      automatable_fraction: task.automatable_fraction,
    })
    setEditSaveError(null)
    setEditDirty(false)
  }, [rawTasks])

  const handleSaveEdit = useCallback(async () => {
    if (!editingNodeId || !editDraft || !projectId) return
    setEditSaving(true)
    setEditSaveError(null)
    const updated = rawTasks.map((t) => {
      if (t.node_id !== editingNodeId) return t
      return {
        ...t,
        label: editDraft.label.trim(),
        app_cluster: editDraft.tools.split(',').map((s) => s.trim()).filter(Boolean),
        duration_distribution: { ...t.duration_distribution, mean_minutes: editDraft.mean_minutes },
        automatable_fraction: editDraft.automatable_fraction,
      }
    })
    try {
      await tasksApi.update(projectId, updated)
      setRawTasks(updated)
      setEditDirty(false)
      // Bust the cache so the next load picks up the updated all_tasks metadata
      clearMarkovCache(projectId)
      setMarkovRefreshKey((k) => k + 1)
    } catch (err) {
      setEditSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }, [editingNodeId, editDraft, projectId, rawTasks])

  // ── Comments state ───────────────────────────────────────────────────────
  const [comments, setComments] = useState<Record<string, NodeComment[]>>(() => {
    try {
      const saved = localStorage.getItem('axisWorkflowComments')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [commentingNode, setCommentingNode] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    localStorage.setItem('axisWorkflowComments', JSON.stringify(comments))
  }, [comments])

  useEffect(() => {
    if (commentingNode && commentInputRef.current) {
      commentInputRef.current.focus()
    }
  }, [commentingNode])

  const handleOpenComment = useCallback((nodeId: string) => {
    setCommentingNode(nodeId)
    setCommentText('')
  }, [])

  const handleSubmitComment = () => {
    if (!commentingNode || !commentText.trim()) return
    const newComment: NodeComment = {
      id: `c-${Date.now()}`,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    }
    setComments((prev) => ({
      ...prev,
      [commentingNode]: [...(prev[commentingNode] ?? []), newComment],
    }))
    setCommentText('')
  }

  const handleDeleteComment = (nodeId: string, commentId: string) => {
    setComments((prev) => ({
      ...prev,
      [nodeId]: (prev[nodeId] ?? []).filter((c) => c.id !== commentId),
    }))
  }

  // ── Nodes with comment + edit handlers ──────────────────────────────────
  const nodesWithComments = useMemo(
    () =>
      existingNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          nodeId: node.id,
          commentCount: (comments[node.id] ?? []).length,
          onComment: handleOpenComment,
          onEdit: handleOpenEdit,
          editMode,
        },
      })),
    [existingNodes, comments, handleOpenComment, handleOpenEdit, editMode],
  )

  const [nodes, , onNodesChange] = useNodesState(nodesWithComments)
  const [edges, setEdges, onEdgesChange] = useEdgesState(existingEdges)

  useEffect(() => {
    onNodesChange(
      nodesWithComments.map((n) => ({ type: 'reset' as const, item: n })),
    )
  }, [nodesWithComments])

  useEffect(() => {
    setEdges(existingEdges)
  }, [existingEdges])

  // ── Derived stats ────────────────────────────────────────────────────────
  const allTools = toolBuckets.flatMap((b) => b.tools)
  const avgUtilization = Math.round(allTools.reduce((sum, t) => sum + t.utilization, 0) / allTools.length)
  const totalUnusedFeatures = allTools.reduce((sum, t) => sum + t.features.filter((f) => !f.used).length, 0)
  const selectedToolData = selectedTool ? allTools.find((t) => t.name === selectedTool) : null
  const taskNodes = existingNodes.filter((n) => n.type === 'taskNode')
  const totalMinutes = taskNodes.reduce((sum, n) => sum + ((n.data as { minutes?: number }).minutes ?? 0), 0)

  const commentingNodeLabel = commentingNode
    ? (existingNodes.find((n) => n.id === commentingNode)?.data as { label?: string } | undefined)?.label ?? commentingNode
    : ''

  const handleRunSimulation = (toolName: string) => {
    localStorage.setItem('axisToolInput', JSON.stringify({ useCase: 'adoption', toolName }))
    if (projectId) {
      navigate(`/projects/${projectId}/tool-input`)
    } else {
      navigate('/toolinput')
    }
  }

  return (
    <ClientWorkspaceShell
      headerLeft={
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img src="/axis-logo.png" alt="Axis logo" className="h-10 w-10 rounded-2xl object-cover" />
            <h1 className="text-[42px] leading-none font-bold tracking-[-0.045em] text-black">Your Workflow</h1>
          </div>
          <p className="mt-2 text-[20px] leading-snug text-black/88">
            {activeTab === 'workspace'
              ? "Your team's current workflow overview and tool insights"
              : 'Simulation results and tool recommendation'}
          </p>
        </div>
      }
    >
      <main className="mx-auto w-full max-w-[1480px] flex-1 space-y-5 px-6 py-5 md:px-10 md:py-6">
        {/* Two fixed tabs */}
        <div className="-mx-6 border-t-2 md:-mx-10" style={{ borderColor: BRAND.violet }}>
          <div
            className="flex min-h-[44px] border-b-2 bg-white"
            style={{ borderBottomColor: 'rgba(94, 20, 159, 0.22)' }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`flex shrink-0 items-center gap-2 border-r border-black/10 px-5 py-2.5 text-[13px] font-semibold transition-colors ${
                activeTab === 'workspace' ? 'bg-[#F4E8FB] text-[#5E149F]' : 'bg-white text-black/70 hover:bg-black/[0.02]'
              }`}
              style={activeTab === 'workspace' ? { boxShadow: 'inset 0 -3px 0 0 #5E149F' } : undefined}
            >
              <LayoutDashboard size={15} className="shrink-0 text-black/50" />
              <span className="whitespace-nowrap">Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`flex shrink-0 items-center gap-2 border-r border-black/10 px-5 py-2.5 text-[13px] font-semibold transition-colors ${
                activeTab === 'report' ? 'bg-[#F4E8FB] text-[#5E149F]' : 'bg-white text-black/70 hover:bg-black/[0.02]'
              }`}
              style={activeTab === 'report' ? { boxShadow: 'inset 0 -3px 0 0 #5E149F' } : undefined}
            >
              <FileText size={15} className="shrink-0 text-black/50" />
              <span className="whitespace-nowrap">Recommendation Report</span>
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(94,20,159,0.12)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Workflow Steps</div>
              <div className="text-2xl font-bold leading-tight text-black">{taskNodes.length}</div>
              <div className="text-[11px] text-black/42 mt-0.5">{totalMinutes} min total cycle</div>
            </div>
            <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(180,48,139,0.12)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.orchid }}>Avg Utilization</div>
              <div className="text-2xl font-bold leading-tight text-black">{avgUtilization}%</div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-black/10">
                <div className="h-1 rounded-full" style={{ width: `${avgUtilization}%`, background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }} />
              </div>
            </div>
            <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(226,64,155,0.14)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.pink }}>Unused Features</div>
              <div className="text-2xl font-bold leading-tight text-black">{totalUnusedFeatures}</div>
              <div className="text-[11px] text-black/42 mt-0.5">across {allTools.length} tools</div>
            </div>
            <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(247,90,140,0.14)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.coral }}>Team Size</div>
              <div className="text-2xl font-bold leading-tight text-black">{roleStats.numEmployees}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-black/42">
                <Users size={11} style={{ color: BRAND.coral }} />
                <span className="line-clamp-2 leading-snug">{roleStats.role.split('(')[0].trim()}s · Active seats</span>
              </div>
            </div>
            <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(226,64,155,0.14)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.pink }}>Tools Avg</div>
              <div className="text-2xl font-bold leading-tight text-black">{roleStats.avgToolsUsed}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-black/42">
                <Layers size={11} style={{ color: BRAND.pink }} />
                Per rep
              </div>
            </div>
            <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(247,90,140,0.14)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.coral }}>Weekly Load</div>
              <div className="text-2xl font-bold leading-tight text-black">{roleStats.avgWeeklyHours}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-black/42">
                <Clock size={11} style={{ color: BRAND.coral }} />
                Hours / week
              </div>
            </div>
        </div>

          {/* ── Workspace tab content ───────────────────────────────────── */}
          {activeTab === 'workspace' && (<>
          <div className="flex flex-col gap-2">
            <div className="flex justify-end px-1">
              <button
                type="button"
                onClick={() => navigate(projectId ? `/projects/${projectId}/tool-input` : '/toolinput')}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_28px_rgba(94,20,159,0.28)] transition-transform hover:-translate-y-0.5 axis-gradient-button"
              >
                <Plus size={16} strokeWidth={2.5} />
                Add new tool
              </button>
            </div>
          <div className="bg-white border rounded-[24px] overflow-hidden" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
              <div className="flex items-center gap-3">
                <BarChart3 size={16} style={{ color: BRAND.violet }} />
                <div>
                  <span className="text-sm font-semibold text-black">Workflow Map</span>
                  {!editMode && isRealData && (
                    <span className="ml-2 text-xs text-black/42">
                      Click <MessageSquare size={10} className="inline" /> on any step to leave feedback
                    </span>
                  )}
                  {editMode && (
                    <span className="ml-2 text-xs font-medium" style={{ color: BRAND.orchid }}>
                      Click <Pencil size={10} className="inline" /> on any step to edit
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Edit mode toggle — visible whenever all_tasks.json has data */}
                {hasTaskData && projectId && (
                  <button
                    type="button"
                    onClick={toggleEditMode}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      editMode
                        ? 'border-[#B4308B]/30 bg-[#FCEAF4] text-[#B4308B]'
                        : 'border-black/12 bg-white text-black/55 hover:border-[#B4308B]/30 hover:text-[#B4308B]'
                    }`}
                  >
                    <Pencil size={12} />
                    {editMode ? 'Done editing' : 'Edit'}
                  </button>
                )}
                {/* Graph status badge */}
                {markovLoading && projectId && (
                  <span className="flex items-center gap-1.5 text-xs text-black/42 font-medium">
                    <span className="w-2 h-2 rounded-full bg-black/20 animate-pulse" />
                    Loading graph...
                  </span>
                )}
                {!markovLoading && isRealData && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#248F63' }}>
                    <span className="w-2 h-2 rounded-full bg-[#248F63]" />
                    Ready · {markovStats?.nStates ?? existingNodes.length} nodes
                  </span>
                )}
                {!markovLoading && !isRealData && !projectId && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-500">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    Fallback
                  </span>
                )}
                {!markovLoading && !isRealData && projectId && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Pipeline not run
                  </span>
                )}
                <div className="flex items-center gap-3 text-xs text-black/42">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: BRAND.violet }} /> Success</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Fail</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: BRAND.coral }} /> Retry</span>
                </div>
              </div>
            </div>

            <div className="relative" style={{ height: 520 }}>
              {/* State A: loading */}
              {markovLoading && projectId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F7F4FB]">
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BRAND.violet, borderTopColor: 'transparent' }} />
                  <span className="text-sm text-black/42">Building workflow graph...</span>
                </div>
              )}

              {/* State B: pipeline not run yet */}
              {!markovLoading && !isRealData && projectId && (
                editMode && rawTasks.length > 0 ? (
                  /* B2: edit mode — show scrollable node list */
                  <div className="absolute inset-0 overflow-y-auto bg-[#F7F4FB] px-5 py-4">
                    <p className="text-xs text-black/42 mb-3">
                      {rawTasks.length} steps extracted from transcripts. Click <Pencil size={10} className="inline" /> to edit any step.
                    </p>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                      {rawTasks.map((task) => {
                        const autoLabel = task.automatable_fraction === 'high' ? 'High automation' : task.automatable_fraction === 'medium' ? 'Med automation' : 'Low automation'
                        const autoCls = task.automatable_fraction === 'high' ? 'text-[#5E149F] bg-[#F4E8FB]' : task.automatable_fraction === 'medium' ? 'text-[#B4308B] bg-[#FCEAF4]' : 'text-[#F75A8C] bg-[#FFE9EF]'
                        return (
                          <div
                            key={task.node_id}
                            className="bg-white rounded-2xl border px-4 py-3 flex items-start justify-between gap-3"
                            style={{ borderColor: BRAND.border, boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-black truncate">{task.label}</div>
                              <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                                {task.app_cluster.slice(0, 3).map((t) => (
                                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F4E8FB] text-[#5E149F] font-medium">{t}</span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-black/42">{Math.round(task.duration_distribution.mean_minutes)}min avg</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${autoCls}`}>{autoLabel}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenEdit(task.node_id)}
                              className="flex-shrink-0 p-1.5 rounded-full hover:bg-[#F4E8FB] transition-colors group"
                              title="Edit step"
                            >
                              <Pencil size={14} className="text-[#5E149F]/40 group-hover:text-[#5E149F]" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  /* B1: no edit mode — original empty state */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#F7F4FB]">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(94,20,159,0.08)' }}>
                      <GitBranch size={24} style={{ color: BRAND.violet }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-black">Your workflow is being prepared</p>
                      <p className="text-xs text-black/42 mt-1">
                        {isAdmin
                          ? 'Submit transcripts and run the pipeline to generate your workflow graph.'
                          : 'Your Axis consultant is setting up your workflow. Check back soon.'}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => navigate(`/projects/${projectId}/transcripts`)}
                        className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-colors"
                        style={{ background: `linear-gradient(90deg, ${BRAND.violet} 0%, ${BRAND.coral} 100%)` }}
                      >
                        <ChevronRight size={15} />
                        Go to Transcripts
                      </button>
                    )}
                  </div>
                )
              )}

              {/* State C: data loaded — show ReactFlow */}
              {(!projectId || isRealData) && (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.3}
                maxZoom={1.5}
              >
                <Controls />
                <MiniMap nodeColor={() => '#CFA3E2'} maskColor="rgba(247,244,251,0.7)" />
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#EADBF3" />
              </ReactFlow>
              )}

              {/* ── Edit panel ────────────────────────────────────────── */}
              {editingNodeId && editDraft && (
                <div className="absolute top-0 right-0 h-full w-80 bg-white border-l shadow-2xl flex flex-col z-10" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BRAND.border }}>
                    <div>
                      <div className="text-xs uppercase tracking-widest font-bold" style={{ color: BRAND.orchid }}>Edit Step</div>
                      <div className="text-sm font-semibold text-black truncate max-w-[200px]">{editDraft.label}</div>
                    </div>
                    <button onClick={() => { setEditingNodeId(null); setEditDraft(null) }} className="p-1.5 rounded-lg hover:bg-black/[0.04] text-black/40 hover:text-black transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {/* Label */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Step Name</label>
                      <input
                        value={editDraft.label}
                        onChange={(e) => { setEditDraft((d) => d ? { ...d, label: e.target.value } : d); setEditDirty(true) }}
                        className="w-full border rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-1"
                        style={{ borderColor: BRAND.border, '--tw-ring-color': BRAND.orchid } as React.CSSProperties}
                      />
                    </div>

                    {/* Tools / app cluster */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Tools Used</label>
                      <input
                        value={editDraft.tools}
                        onChange={(e) => { setEditDraft((d) => d ? { ...d, tools: e.target.value } : d); setEditDirty(true) }}
                        placeholder="Salesforce, Slack, ..."
                        className="w-full border rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-1"
                        style={{ borderColor: BRAND.border, '--tw-ring-color': BRAND.orchid } as React.CSSProperties}
                      />
                      <p className="text-[10px] text-black/38 mt-1">Comma-separated list</p>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Avg Duration (min)</label>
                      <input
                        type="number"
                        min={1}
                        value={editDraft.mean_minutes}
                        onChange={(e) => { setEditDraft((d) => d ? { ...d, mean_minutes: Number(e.target.value) } : d); setEditDirty(true) }}
                        className="w-full border rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-1"
                        style={{ borderColor: BRAND.border, '--tw-ring-color': BRAND.orchid } as React.CSSProperties}
                      />
                    </div>

                    {/* Automatable fraction */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Automation Potential</label>
                      <select
                        value={editDraft.automatable_fraction}
                        onChange={(e) => { setEditDraft((d) => d ? { ...d, automatable_fraction: e.target.value } : d); setEditDirty(true) }}
                        className="w-full border rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 bg-white"
                        style={{ borderColor: BRAND.border }}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    {editSaveError && (
                      <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                        <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                        {editSaveError}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: BRAND.border }}>
                    <button
                      onClick={handleSaveEdit}
                      disabled={editSaving || !editDirty}
                      className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl disabled:opacity-50 transition-opacity"
                      style={{ background: `linear-gradient(90deg, ${BRAND.violet} 0%, ${BRAND.coral} 100%)` }}
                    >
                      {editSaving ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <p className="text-center text-[10px] text-black/38">Changes update all_tasks.json. Re-run pipeline to regenerate graph.</p>
                  </div>
                </div>
              )}

              {/* ── Comment panel ─────────────────────────────────────── */}
              {commentingNode && (
                <div className="absolute top-0 right-0 h-full w-80 bg-white border-l shadow-2xl flex flex-col z-10 animate-fade-in" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BRAND.border }}>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-widest font-bold" style={{ color: BRAND.violet }}>Feedback</div>
                      <div className="text-sm font-semibold text-black truncate">{commentingNodeLabel}</div>
                    </div>
                    <button onClick={() => setCommentingNode(null)} className="p-1.5 rounded-lg hover:bg-black/[0.04] text-black/40 hover:text-black transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {(comments[commentingNode] ?? []).length === 0 && (
                      <p className="text-xs text-black/40 text-center py-6">No feedback yet. Something look off? Let us know below.</p>
                    )}
                    {(comments[commentingNode] ?? []).map((c) => (
                      <div key={c.id} className="bg-[#F7F4FB] border rounded-2xl p-3 group" style={{ borderColor: BRAND.border }}>
                        <p className="text-sm text-black/78 leading-relaxed">{c.text}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-black/38">
                            {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <button onClick={() => handleDeleteComment(commentingNode, c.id)} className="text-[10px] text-black/38 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t" style={{ borderColor: BRAND.border }}>
                    <div className="flex gap-2">
                      <textarea
                        ref={commentInputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment() } }}
                        placeholder="What needs to change here?"
                        rows={2}
                        className="flex-1 bg-[#F7F4FB] border rounded-2xl px-3 py-2 text-sm resize-none transition-colors text-black placeholder:text-black/30 focus:outline-none"
                        style={{ borderColor: BRAND.border }}
                      />
                      <button onClick={handleSubmitComment} disabled={!commentText.trim()} className="self-end p-2.5 disabled:bg-black/10 disabled:text-black/30 text-white rounded-2xl transition-colors" style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}>
                        <Send size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-black/36 mt-1.5">Press Enter to send</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* ── Bottom grid: Tool stack + simulations ───────────────────── */}
          <div className="grid gap-5 xl:grid-cols-[7fr_3fr]">
            <div className="bg-white border rounded-[24px] p-5 max-h-[520px] overflow-y-auto" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Tool Stack</h3>
                <span className="text-xs text-black/38">{avgUtilization}% avg utilization</span>
              </div>

              {/* Tool list with utilization bars */}
              {!selectedToolData && (
                <div className="space-y-4">
                  {toolBuckets.map((bucket) => (
                    <div key={bucket.category}>
                      <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${bucketColorMap[bucket.color]}`}>
                        {bucket.category}
                      </span>
                      <div className="mt-2 space-y-1.5 pl-1">
                        {bucket.tools.map((tool) => {
                          const unusedCount = tool.features.filter((f) => !f.used).length
                          return (
                            <button
                              key={tool.name}
                              onClick={() => setSelectedTool(tool.name)}
                              className="w-full text-left px-2.5 py-2 rounded-2xl text-black/72 hover:bg-black/[0.03] transition-all"
                            >
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-medium">{tool.name}</span>
                                <span className={`font-semibold ${tool.utilization < 40 ? 'text-gold-300' : tool.utilization < 60 ? 'text-slate-400' : 'text-sea-300'}`}>
                                  {tool.utilization}%
                                </span>
                              </div>
                              <div className="w-full bg-black/10 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full transition-all ${tool.utilization < 40 ? 'bg-gold' : tool.utilization < 60 ? 'bg-cerulean' : 'bg-sea'}`}
                                  style={{ width: `${tool.utilization}%` }}
                                />
                              </div>
                              {unusedCount > 0 && (
                                <div className="text-[10px] text-black/34 mt-1">{unusedCount} unused feature{unusedCount !== 1 ? 's' : ''}</div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected tool detail — features used vs unused */}
              {selectedToolData && (
                <div>
                  <button
                    onClick={() => setSelectedTool(null)}
                    className="flex items-center gap-1 text-xs text-black/46 hover:text-black mb-3 transition-colors"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                    Back to all tools
                  </button>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-black">{selectedToolData.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${selectedToolData.utilization < 40 ? 'bg-gold-500/15 text-gold-300' : 'bg-sea-500/15 text-sea-300'}`}>
                      {selectedToolData.utilization}% utilized
                    </span>
                  </div>
                  <div className="w-full bg-black/10 rounded-full h-1.5 mb-4">
                    <div
                      className={`h-1.5 rounded-full ${selectedToolData.utilization < 40 ? 'bg-gold' : selectedToolData.utilization < 60 ? 'bg-cerulean' : 'bg-sea'}`}
                      style={{ width: `${selectedToolData.utilization}%` }}
                    />
                  </div>

                  {/* Used features */}
                  <div className="text-[10px] font-bold text-black/42 uppercase tracking-widest mb-2">Using</div>
                  <div className="space-y-1.5 mb-4">
                    {selectedToolData.features.filter((f) => f.used).map((f) => (
                      <div key={f.name} className="flex items-start gap-2 px-2 py-1.5 rounded-2xl bg-[#F6FFFA] border border-sea-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-sea mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-black/78">{f.name}</div>
                          <div className="text-[10px] text-black/40">{f.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Unused features */}
                  <div className="text-[10px] font-bold text-[#B4308B] uppercase tracking-widest mb-2">Not Using</div>
                  <div className="space-y-1.5 mb-4">
                    {selectedToolData.features.filter((f) => !f.used).map((f) => (
                      <div key={f.name} className="flex items-start gap-2 px-2 py-1.5 rounded-2xl bg-[#FFF7FC] border border-[#E2409B]/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-black/78">{f.name}</div>
                          <div className="text-[10px] text-black/40">{f.description}</div>
                          {f.workflowStep && (
                            <div className="text-[10px] mt-0.5" style={{ color: BRAND.violet }}>
                              Could save ~{f.potentialTimeSaved}min at "{f.workflowStep}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleRunSimulation(selectedToolData.name)}
                    className="w-full flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-2xl font-semibold text-xs transition-colors"
                    style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
                  >
                    <Play size={13} />
                    Simulate Full Adoption
                  </button>
                </div>
              )}
            </div>

            {/* ── Recent Simulations card ──────────────────────────────── */}
            <div className="bg-white border rounded-[24px] p-5" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Simulations</h3>
                <span className="text-xs text-black/38">{apiToolEvals?.length ?? 0} runs</span>
              </div>
              <div className="space-y-2">
                {!apiToolEvals?.length ? (
                  <p className="rounded-2xl border border-black/8 bg-[#FBFAFD] px-4 py-6 text-center text-xs text-black/45">
                    No simulations yet. Add a tool to get started.
                  </p>
                ) : (
                  apiToolEvals.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => projectId
                        ? navigate(`/projects/${projectId}/simulation/${e.id}`)
                        : focusSimulationTab(e.id)
                      }
                      className="group flex w-full items-center justify-between rounded-2xl border bg-[#FBFAFD] px-4 py-3 transition-colors hover:border-black/12"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-black">{e.tool_name}</div>
                        <div className="mt-0.5 text-xs text-black/42">{e.created_at.slice(0, 10)}</div>
                      </div>
                      <ChevronRight size={14} className="text-black/32" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          </>)}

          {/* ── Recommendation Report tab content ────────────────────────── */}
          {activeTab === 'report' && (
            <div className="space-y-5">
              {/* Loading */}
              {reportLoading && (
                <div className="flex items-center justify-center py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10" style={{ borderTopColor: BRAND.orchid }} />
                </div>
              )}

              {/* No simulations yet */}
              {!reportLoading && !apiToolEvals?.length && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border bg-[#F7F4FB] py-20 text-center" style={{ borderColor: BRAND.border }}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(94,20,159,0.08)' }}>
                    <FileText size={26} style={{ color: BRAND.violet }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-black">No report yet</p>
                    <p className="mt-1 text-xs text-black/42">Add a tool from the Workspace tab and run a simulation to generate your recommendation report.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('workspace')}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold text-white axis-gradient-button"
                  >
                    <Plus size={14} />
                    Go to Workspace
                  </button>
                </div>
              )}

              {/* Report data */}
              {!reportLoading && reportRec && apiToolEvals?.length && (
                <>
                  {/* Tool header + confidence */}
                  <div className="flex items-center justify-between rounded-[18px] border bg-white px-5 py-4" style={{ borderColor: BRAND.border }}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Latest Simulation</p>
                      <p className="mt-0.5 text-[22px] font-bold text-black">{reportRec.tool_name}</p>
                      <p className="mt-1 text-sm text-black/55">{reportRec.summary}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 rounded-[14px] border px-5 py-3 text-center" style={{ borderColor: 'rgba(94,20,159,0.15)', background: 'rgba(94,20,159,0.04)' }}>
                      <Award size={18} style={{ color: BRAND.violet }} />
                      <span className="text-2xl font-bold" style={{ color: BRAND.violet }}>{Math.round(reportRec.confidence_score * 100)}%</span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-black/40">Confidence</span>
                    </div>
                  </div>

                  {/* Key metrics */}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[18px] border bg-white px-4 py-4" style={{ borderColor: 'rgba(94,20,159,0.12)' }}>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>
                        <Clock size={12} /> Time Saved / Rep
                      </div>
                      <div className="mt-2 text-2xl font-bold text-black">
                        {reportRec.employee_impact.time_saved.p10}–{reportRec.employee_impact.time_saved.p70}
                        <span className="ml-1 text-sm font-normal text-black/40">hrs/wk</span>
                      </div>
                      <div className="mt-1 text-xs text-black/42">p10–p70 range across reps</div>
                    </div>
                    <div className="rounded-[18px] border bg-white px-4 py-4" style={{ borderColor: 'rgba(180,48,139,0.12)' }}>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.orchid }}>
                        <Zap size={12} /> Throughput Lift
                      </div>
                      <div className="mt-2 text-2xl font-bold text-black">
                        {reportRec.company_impact.throughput.p10}–{reportRec.company_impact.throughput.p70}
                        <span className="ml-1 text-sm font-normal text-black/40">%</span>
                      </div>
                      <div className="mt-1 text-xs text-black/42">more deals closed per rep</div>
                    </div>
                    <div className="rounded-[18px] border bg-white px-4 py-4" style={{ borderColor: 'rgba(247,90,140,0.12)' }}>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.coral }}>
                        <TrendingUp size={12} /> Revenue Impact
                      </div>
                      <div className="mt-2 text-2xl font-bold text-black">
                        ${reportRec.company_impact.revenue_impact.p10}k–${reportRec.company_impact.revenue_impact.p70}k
                      </div>
                      <div className="mt-1 text-xs text-black/42">projected uplift</div>
                    </div>
                  </div>

                  {/* Workflow map */}
                  <div className="bg-white border rounded-[24px] overflow-hidden" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
                    <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
                      <BarChart3 size={16} style={{ color: BRAND.violet }} />
                      <span className="text-sm font-semibold text-black">Workflow Map</span>
                    </div>
                    <div style={{ height: 420 }}>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        minZoom={0.3}
                        maxZoom={1.5}
                      >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#EADBF3" />
                      </ReactFlow>
                    </div>
                  </div>

                  {/* Use cases */}
                  {reportRec.use_cases.length > 0 && (
                    <div className="bg-white border rounded-[24px] p-5" style={{ borderColor: BRAND.border }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BRAND.violet }}>Key Use Cases</h3>
                      <div className="space-y-3">
                        {reportRec.use_cases.map((uc, i) => (
                          <div key={i} className="rounded-[16px] border bg-[#F7F4FB] px-4 py-3" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
                            <p className="text-sm font-semibold text-black">{uc.title}</p>
                            <p className="mt-0.5 text-xs text-black/55">{uc.description}</p>
                          </div>
                        ))}
                      </div>
                      {projectId && apiToolEvals?.[0] && (
                        <button
                          onClick={() => navigate(`/projects/${projectId}/recommendation/${apiToolEvals[0].id}`)}
                          className="mt-4 w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-bold text-white axis-gradient-button"
                        >
                          <FileText size={14} />
                          View Full Recommendation
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Fetched OK but no recommendation data yet (simulation not run) */}
              {!reportLoading && apiToolEvals?.length && !reportRec && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border bg-[#F7F4FB] py-16 text-center" style={{ borderColor: BRAND.border }}>
                  <p className="text-sm font-semibold text-black">Simulation not run yet</p>
                  <p className="text-xs text-black/42">Run a simulation from the Workspace tab to generate your report.</p>
                  <button
                    onClick={() => setActiveTab('workspace')}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold text-white axis-gradient-button"
                  >
                    Go to Workspace
                  </button>
                </div>
              )}
            </div>
          )}

        </main>
    </ClientWorkspaceShell>
  )
}

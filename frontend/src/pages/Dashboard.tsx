import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { useMarkovData } from '../hooks/pullMarkovData'
import { buildLoadedMarkovData, clearMarkovCache } from '../hooks/dataLoader'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { taskEditRequests as taskEditRequestsApi, toolEvals as toolEvalsApi, projects as projectsApi, recommendation as recommendationApi, simulation as simulationApi, tasks as tasksApi, topology as topologyApi } from '../api/client'
import type { ToolEvaluation, Project, RecommendationData, SimulationData, TaskEditRequest, TaskNode as ApiTaskNode } from '../api/client'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
} from 'reactflow'
import type { Connection, NodeChange, EdgeChange } from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Users,
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
  Loader2,
  Pencil,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import CosmoChatWidget from '../components/workspace/CosmoChatWidget'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { useJobProgress } from '../hooks/useJobProgress'
import { useGsapReveal } from '../hooks/useGsapReveal'
import { useTheme } from '../hooks/useTheme'
import type { TransitionMatrixJSON } from '../schema.tsx'

// ── Types ────────────────────────────────────────────────────────────────────

interface NodeComment {
  id: string
  text: string
  createdAt: string
}

const BRAND = {
  shell:  'var(--surface-page)',
  panel:  'var(--surface-card)',
  border: 'var(--border-accent)',
  text:   'var(--text-primary)',
  muted:  'var(--text-secondary)',
  violet: 'var(--axis-violet-900)',
  orchid: 'var(--axis-violet-700)',
  pink:   'var(--axis-pink-500)',
  coral:  'var(--axis-coral-400)',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId, toolEvalId } = useParams<{ projectId?: string; toolEvalId?: string }>()
  const rootRef = useRef<HTMLDivElement>(null)
  const editPanelRef = useRef<HTMLDivElement>(null)
  const commentPanelRef = useRef<HTMLDivElement>(null)

  const [markovRefreshKey, setMarkovRefreshKey] = useState(0)
  const { existingNodes, existingEdges, loading: markovLoading, isRealData, stats: markovStats } =
    useMarkovData(projectId, markovRefreshKey)
  const isAdmin = useIsAdmin()
  const { theme } = useTheme()
  const [apiProject, setApiProject] = useState<Project | null>(null)
  const [apiToolEvals, setApiToolEvals] = useState<ToolEvaluation[] | null>(null)
  const [pipelineTaskNodes, setPipelineTaskNodes] = useState<ApiTaskNode[]>([])
  const [taskEditRequests, setTaskEditRequests] = useState<TaskEditRequest[]>([])

  useEffect(() => {
    if (!projectId) return
    projectsApi.get(projectId).then(setApiProject).catch(() => { })
    toolEvalsApi.list(projectId).then(setApiToolEvals).catch(() => { })
    // Fetch tasks for task-data check, tool stack derivation, and the edit panel
    tasksApi.get(projectId)
      .then((nodes) => {
        setPipelineTaskNodes(nodes)
        setRawTasks(nodes)
      })
      .catch(() => { setPipelineTaskNodes([]); setRawTasks([]) })
    taskEditRequestsApi.list(projectId)
      .then(setTaskEditRequests)
      .catch(() => setTaskEditRequests([]))
  }, [projectId, markovRefreshKey])

  // Derive tool list from task app_cluster
  const derivedToolList = useMemo(() => {
    if (pipelineTaskNodes.length === 0) return []
    const map: Record<string, { minutes: number; count: number }> = {}
    for (const task of pipelineTaskNodes) {
      for (const tool of task.app_cluster) {
        if (!map[tool]) map[tool] = { minutes: 0, count: 0 }
        map[tool].minutes += task.duration_distribution.mean_minutes
        map[tool].count++
      }
    }
    return Object.entries(map)
      .map(([name, { minutes, count }]) => ({ name, weeklyHrs: +(minutes / 60 / 5).toFixed(1), count }))
      .sort((a, b) => b.weeklyHrs - a.weeklyHrs)
  }, [pipelineTaskNodes])

  const selectedToolEval = useMemo(
    () => apiToolEvals?.find((toolEval) => toolEval.id === toolEvalId) ?? null,
    [apiToolEvals, toolEvalId],
  )
  const activeTab = toolEvalId ? `simulation:${toolEvalId}` : 'workspace'
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendationData | null>(null)
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationData | null>(null)
  const [selectedSimulationLoading, setSelectedSimulationLoading] = useState(false)

  // Pipeline job tracking (set when navigating here from TranscriptInput "Visualise Workflow")
  const [inboundPipelineJobId, setInboundPipelineJobId] = useState<string | null>(null)
  const {
    job: pipelineInboundJob,
    isDone: pipelineInboundDone,
    isFailed: pipelineInboundFailed,
  } = useJobProgress(inboundPipelineJobId)

  const activeSimulationJobId = selectedToolEval?.latest_job_id ?? null
  const {
    job: activeSimulationJob,
    isDone: activeSimulationDone,
    isFailed: activeSimulationFailed,
  } = useJobProgress(activeSimulationJobId)

  useGsapReveal(
    rootRef,
    [
      activeTab,
      projectId,
      existingNodes.length,
      existingEdges.length,
      apiToolEvals?.length,
      selectedSimulationLoading,
      !!selectedRecommendation,
      markovLoading,
    ],
    {
      selectors: [
        '[data-gsap-dashboard-header]',
        '[data-gsap-dashboard-tabs]',
        '[data-gsap-dashboard-stats]',
        '[data-gsap-dashboard-panel]',
        '[data-gsap-dashboard-simulation]',
      ],
      duration: 0.62,
      stagger: 0.08,
      y: 18,
      blur: 10,
    },
  )

  // On mount: read nav state for either a pipeline job or a simulation job
  useEffect(() => {
    const state = location.state as { pipelineJobId?: string; recentSimulationId?: string } | null
    if (state?.pipelineJobId) {
      setInboundPipelineJobId(state.pipelineJobId)
    }
    if (state?.pipelineJobId || state?.recentSimulationId) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [location.state, location.pathname])

  // When the inbound pipeline job completes, bust the Markov cache and refresh
  useEffect(() => {
    if (!pipelineInboundDone || !projectId) return
    clearMarkovCache(projectId)
    setMarkovRefreshKey((k) => k + 1)
  }, [pipelineInboundDone, projectId])

  useEffect(() => {
    if (!projectId || !toolEvalId) {
      setSelectedRecommendation(null)
      setSelectedSimulation(null)
      setSelectedSimulationLoading(false)
      return
    }

    setSelectedSimulationLoading(true)
    Promise.all([
      recommendationApi.get(projectId, toolEvalId).catch(() => null),
      simulationApi.get(projectId, toolEvalId).catch(() => null),
    ])
      .then(([recommendation, simulation]) => {
        setSelectedRecommendation(recommendation)
        setSelectedSimulation(simulation)
      })
      .finally(() => setSelectedSimulationLoading(false))
  }, [projectId, toolEvalId, selectedToolEval?.status])

  useEffect(() => {
    if (!projectId || !apiToolEvals?.some((toolEval) => toolEval.status === 'queued' || toolEval.status === 'running')) return
    const intervalId = window.setInterval(() => {
      toolEvalsApi.list(projectId).then(setApiToolEvals).catch(() => {})
    }, 2000)
    return () => window.clearInterval(intervalId)
  }, [projectId, apiToolEvals])

  useEffect(() => {
    if (!projectId || (!activeSimulationDone && !activeSimulationFailed)) return
    toolEvalsApi.list(projectId).then(setApiToolEvals).catch(() => {})
  }, [projectId, activeSimulationDone, activeSimulationFailed])


  // ── Edit mode state ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [rawTasks, setRawTasks] = useState<ApiTaskNode[]>([])
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{
    label: string
    tools: string
    mean_minutes: number
    automatable_fraction: string
    role_type: string
    workflow_type: string
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editSaveError, setEditSaveError] = useState<string | null>(null)
  const [editSaveSuccess, setEditSaveSuccess] = useState<string | null>(null)
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

  const handleOpenEdit = useCallback(async (nodeId: string) => {
    let tasks = rawTasks
    if (!tasks.length && projectId) {
      try {
        tasks = await tasksApi.get(projectId)
        setRawTasks(tasks)
      } catch {
        tasks = []
      }
    }

    const task = tasks.find((t) => t.node_id === nodeId)
    if (!task) return
    setEditingNodeId(nodeId)
    setEditDraft({
      label: task.label,
      tools: task.app_cluster.join(', '),
      mean_minutes: task.duration_distribution.mean_minutes,
      automatable_fraction: task.automatable_fraction,
      role_type: task.role_type ?? '',
      workflow_type: task.workflow_type ?? '',
    })
    setEditSaveError(null)
    setEditSaveSuccess(null)
    setEditDirty(false)
  }, [projectId, rawTasks])

  const handleSaveEdit = useCallback(async () => {
    if (!editingNodeId || !editDraft || !projectId) return
    const currentTask = rawTasks.find((t) => t.node_id === editingNodeId)
    if (!currentTask) {
      setEditSaveError('We could not load the source task for this step.')
      return
    }
    setEditSaving(true)
    setEditSaveError(null)
    setEditSaveSuccess(null)
    const proposedTask: ApiTaskNode = {
      ...currentTask,
      label: editDraft.label.trim(),
      app_cluster: editDraft.tools.split(',').map((s) => s.trim()).filter(Boolean),
      duration_distribution: { ...currentTask.duration_distribution, mean_minutes: editDraft.mean_minutes },
      automatable_fraction: editDraft.automatable_fraction,
      role_type: editDraft.role_type.trim() || undefined,
      workflow_type: editDraft.workflow_type.trim() || undefined,
    }
    try {
      const created = await taskEditRequestsApi.create(projectId, {
        node_id: editingNodeId,
        current_task: currentTask,
        proposed_task: proposedTask,
      })
      setTaskEditRequests((prev) => [created, ...prev])
      setEditDirty(false)
      setEditSaveSuccess('Submitted for admin review. Approved changes will update the workflow.')
    } catch (err) {
      setEditSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }, [editingNodeId, editDraft, projectId, rawTasks])

  // ── Topology (positions + edges) persistence ────────────────────────────
  const [topologyPositions, setTopologyPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [topologyEdges, setTopologyEdges] = useState<ReturnType<typeof useEdgesState>[0] | null>(null)
  const [topoSaveState, setTopoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const topoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodesRef = useRef<ReturnType<typeof useNodesState>[0]>([])
  const edgesRef = useRef<ReturnType<typeof useEdgesState>[0]>([])

  useEffect(() => {
    if (!projectId) return
    topologyApi.get(projectId)
      .then((topo) => {
        if (topo.positions && Object.keys(topo.positions).length) {
          setTopologyPositions(topo.positions as Record<string, { x: number; y: number }>)
        }
        if (topo.edges?.length) {
          setTopologyEdges(topo.edges as ReturnType<typeof useEdgesState>[0])
        }
      })
      .catch(() => { }) // 404 = no topology saved yet, fine
  }, [projectId])

  const scheduleSave = useCallback(() => {
    if (!projectId) return
    if (topoSaveTimer.current) clearTimeout(topoSaveTimer.current)
    setTopoSaveState('saving')
    topoSaveTimer.current = setTimeout(async () => {
      try {
        const positions: Record<string, { x: number; y: number }> = {}
        for (const n of nodesRef.current) positions[n.id] = n.position
        await topologyApi.save(projectId, {
          positions,
          edges: edgesRef.current as Array<Record<string, unknown>>,
        })
        setTopologyPositions(positions)
        setTopoSaveState('saved')
        setTimeout(() => setTopoSaveState((s) => s === 'saved' ? 'idle' : s), 2000)
      } catch {
        setTopoSaveState('error')
      }
    }, 800)
  }, [projectId])

  const pendingRequestByNodeId = useMemo(() => {
    const pairs = taskEditRequests
      .filter((request) => request.status === 'pending')
      .map((request) => [request.node_id, request] as const)
    return Object.fromEntries(pairs)
  }, [taskEditRequests])
  const canPersistTaskEdits = !!projectId
  const hasEditableTaskData = rawTasks.length > 0

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

  useEffect(() => {
    const scope = rootRef.current
    if (!scope || markovLoading) return

    const nodeEls = gsap.utils.toArray<HTMLElement>('.react-flow__node', scope)
    const edgeEls = gsap.utils.toArray<HTMLElement>('.react-flow__edge-path', scope)

    if (!nodeEls.length && !edgeEls.length) return

    const tl = gsap.timeline()
    tl.fromTo(nodeEls, {
      autoAlpha: 0,
      y: 16,
      scale: 0.96,
      transformOrigin: '50% 50%',
    }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.42,
      stagger: 0.025,
      ease: 'power3.out',
      clearProps: 'transform',
    }).fromTo(edgeEls, {
      autoAlpha: 0,
    }, {
      autoAlpha: 1,
      duration: 0.28,
      stagger: 0.008,
      ease: 'power1.out',
    }, '-=0.18')

    return () => {
      tl.kill()
    }
  }, [activeTab, existingNodes.length, existingEdges.length, markovLoading, selectedRecommendation])

  useEffect(() => {
    const panel = editPanelRef.current
    if (!panel) return

    gsap.fromTo(panel, {
      x: 36,
      autoAlpha: 0,
    }, {
      x: 0,
      autoAlpha: 1,
      duration: 0.32,
      ease: 'power3.out',
    })
  }, [editingNodeId])

  useEffect(() => {
    const panel = commentPanelRef.current
    if (!panel) return

    gsap.fromTo(panel, {
      x: 36,
      autoAlpha: 0,
    }, {
      x: 0,
      autoAlpha: 1,
      duration: 0.32,
      ease: 'power3.out',
    })
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
        position: topologyPositions[node.id] ?? node.position,
        data: {
          ...node.data,
          nodeId: node.id,
          commentCount: (comments[node.id] ?? []).length,
          hasPendingEdit: !!pendingRequestByNodeId[node.id],
          onComment: handleOpenComment,
          onEdit: canPersistTaskEdits ? handleOpenEdit : undefined,
          editMode,
        },
      })),
    [canPersistTaskEdits, existingNodes, comments, handleOpenComment, handleOpenEdit, editMode, pendingRequestByNodeId, topologyPositions],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithComments)
  const [edges, setEdges, onEdgesChange] = useEdgesState(existingEdges)

  // Keep refs in sync for debounced topology save
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  useEffect(() => {
    onNodesChange(
      nodesWithComments.map((n) => ({ type: 'reset' as const, item: n })),
    )
  }, [nodesWithComments])

  useEffect(() => {
    setEdges(topologyEdges ?? existingEdges)
  }, [existingEdges, topologyEdges])

  // Save topology when nodes are dragged (drag end only) or removed
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    if (!editMode) return
    const shouldSave = changes.some(
      (c) => (c.type === 'position' && !c.dragging) || c.type === 'remove',
    )
    if (shouldSave) scheduleSave()
  }, [editMode, onNodesChange, scheduleSave])

  // Save topology when edges are removed
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
    if (!editMode) return
    if (changes.some((c) => c.type === 'remove')) scheduleSave()
  }, [editMode, onEdgesChange, scheduleSave])

  // Add a new edge when user draws a connection
  const handleConnect = useCallback((connection: Connection) => {
    if (!editMode) return
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          type: 'smoothstep',
          style: { stroke: 'var(--axis-violet-900)', strokeWidth: 2.5 },
        },
        eds,
      ),
    )
    scheduleSave()
  }, [editMode, setEdges, scheduleSave])

  // ── Derived stats ────────────────────────────────────────────────────────
  const taskNodes = existingNodes.filter((n) => n.type === 'taskNode')
  const totalMinutes = taskNodes.reduce((sum, n) => sum + ((n.data as { minutes?: number }).minutes ?? 0), 0)

  const commentingNodeLabel = commentingNode
    ? (existingNodes.find((n) => n.id === commentingNode)?.data as { label?: string } | undefined)?.label ?? commentingNode
    : ''
  const editingNodePendingRequest = editingNodeId ? pendingRequestByNodeId[editingNodeId] : null
  const selectedSimulationLabel = selectedToolEval ? `${selectedToolEval.tool_name} Simulation` : 'Simulation'
  const baselineWorkflow = useMemo(
    () => (
      selectedSimulation?.baseline_transition_matrix_json
        ? buildLoadedMarkovData(
            selectedSimulation.baseline_transition_matrix_json as unknown as TransitionMatrixJSON,
            pipelineTaskNodes,
          )
        : null
    ),
    [selectedSimulation?.baseline_transition_matrix_json, pipelineTaskNodes],
  )
  const toolWorkflow = useMemo(
    () => (
      selectedSimulation?.tool_transition_matrix_json
        ? buildLoadedMarkovData(
            selectedSimulation.tool_transition_matrix_json as unknown as TransitionMatrixJSON,
            pipelineTaskNodes,
          )
        : null
    ),
    [selectedSimulation?.tool_transition_matrix_json, pipelineTaskNodes],
  )
  const cosmoDemoContext = useMemo(
    () => ({
      active_tab: activeTab === 'workspace' ? 'workspace' : 'simulation',
      workflow_stats: {
        node_count: taskNodes.length,
        edge_count: existingEdges.length,
        total_minutes: totalMinutes,
      },
      tools: derivedToolList.slice(0, 10),
      nodes: existingNodes.slice(0, 12).map((node) => ({
        id: node.id,
        label: (node.data as { label?: string }).label ?? node.id,
        minutes: (node.data as { minutes?: number }).minutes ?? null,
      })),
      selected_simulation: selectedToolEval
        ? {
            tool_name: selectedToolEval.tool_name,
            recommendation_summary: selectedRecommendation?.summary ?? null,
            work_saved_pct: selectedSimulation?.final_work_saved_pct ?? null,
            throughput_lift_pct: selectedSimulation?.final_throughput_lift_pct ?? null,
          }
        : null,
    }),
    [
      activeTab,
      taskNodes.length,
      existingEdges.length,
      totalMinutes,
      derivedToolList,
      existingNodes,
      selectedToolEval,
      selectedRecommendation,
      selectedSimulation,
    ],
  )

  return (
    <ClientWorkspaceShell
      projectId={projectId}
      headerLeft={
        <div data-gsap-dashboard-header className="min-w-0">
          <div className="flex items-center gap-3">
            <img src="/axis-logo.png" alt="Axis logo" className="h-10 w-10 rounded-2xl object-cover" />
            <h1 className="text-[42px] leading-none font-bold tracking-[-0.045em] text-black">Your Workflow</h1>
          </div>
          <p className="mt-2 text-[20px] leading-snug text-black/88">
            {activeTab === 'workspace'
              ? "Your team's current workflow overview and tool insights"
              : `${selectedToolEval?.tool_name ?? 'Tool'} simulation results and workflow comparison`}
          </p>
        </div>
      }
    >
      <main ref={rootRef} className="mx-auto w-full max-w-[1480px] flex-1 space-y-5 px-4 py-5 md:px-10 md:py-6">
        {/* Two fixed tabs */}
        <div data-gsap-dashboard-tabs className="-mx-4 border-t-2 md:-mx-10" style={{ borderColor: BRAND.violet }}>
          <div
            className="flex min-h-[44px] border-b-2 bg-white"
            style={{ borderBottomColor: 'var(--border-accent)' }}
          >
            <button
              type="button"
              onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')}
              className={`flex shrink-0 items-center gap-2 border-r border-black/10 px-5 py-2.5 text-[13px] font-semibold transition-colors ${activeTab === 'workspace' ? 'bg-[var(--surface-accent-subtle)] text-axispurple-900' : 'bg-white text-black/70 hover:bg-black/[0.02]'
                }`}
              style={activeTab === 'workspace' ? { boxShadow: 'inset 0 -3px 0 0 var(--axis-violet-900)' } : undefined}
            >
              <LayoutDashboard size={15} className="shrink-0 text-black/50" />
              <span className="whitespace-nowrap">Workspace</span>
            </button>
            {selectedToolEval && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}/dashboard/simulations/${selectedToolEval.id}`)}
                className={`flex shrink-0 items-center gap-2 border-r border-black/10 px-5 py-2.5 text-[13px] font-semibold transition-colors ${activeTab !== 'workspace' ? 'bg-[var(--surface-accent-subtle)] text-axispurple-900' : 'bg-white text-black/70 hover:bg-black/[0.02]'
                  }`}
                style={activeTab !== 'workspace' ? { boxShadow: 'inset 0 -3px 0 0 var(--axis-violet-900)' } : undefined}
              >
                <FileText size={15} className="shrink-0 text-black/50" />
                <span className="whitespace-nowrap">{selectedSimulationLabel}</span>
              </button>
            )}
          </div>
        </div>

        <div data-gsap-dashboard-stats className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(94,20,159,0.12)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Workflow Steps</div>
            <div className="text-2xl font-bold leading-tight text-black">{taskNodes.length || '—'}</div>
            <div className="text-[11px] text-black/42 mt-0.5">{totalMinutes ? `${totalMinutes} min total cycle` : 'Run pipeline to populate'}</div>
          </div>
          <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(247,90,140,0.14)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.coral }}>Team Size</div>
            <div className="text-2xl font-bold leading-tight text-black">{apiProject?.team_size ?? '—'}</div>
            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-black/42">
              <Users size={11} style={{ color: BRAND.coral }} />
              <span className="line-clamp-2 leading-snug">{apiProject?.primary_role ?? 'reps'} · Active seats</span>
            </div>
          </div>
          <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(180,48,139,0.12)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.orchid }}>Tools in Stack</div>
            <div className="text-2xl font-bold leading-tight text-black">{derivedToolList.length || '—'}</div>
            <div className="text-[11px] text-black/42 mt-0.5">{derivedToolList.length > 0 ? 'Extracted from workflow tasks' : 'Run pipeline to populate'}</div>
          </div>
          <div className="rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: 'rgba(226,64,155,0.14)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.pink }}>Simulations Run</div>
            <div className="text-2xl font-bold leading-tight text-black">{apiToolEvals?.length ?? '—'}</div>
            <div className="text-[11px] text-black/42 mt-0.5">Tool evaluations</div>
          </div>
        </div>

        {/* ── Workspace tab content ───────────────────────────────────── */}
        {activeTab === 'workspace' && (<>
          <div data-gsap-dashboard-panel className="flex flex-col gap-2">
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
                    {isRealData && canPersistTaskEdits && (
                      <span className="ml-2 text-xs text-black/42">
                        Click <Pencil size={10} className="inline" /> to edit a step · <MessageSquare size={10} className="inline" /> to leave feedback
                      </span>
                    )}
                    {isRealData && !canPersistTaskEdits && (
                      <span className="ml-2 text-xs text-black/42">
                        Open a project-scoped dashboard to submit workflow edits.
                      </span>
                    )}
                    {editMode && (
                      <span className="ml-2 text-xs font-medium" style={{ color: BRAND.orchid }}>
                        · Drag nodes · draw connections · Backspace to delete
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Edit mode toggle — visible whenever this project has editable task data */}
                  {canPersistTaskEdits && hasEditableTaskData && (
                    <button
                      type="button"
                      onClick={toggleEditMode}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${editMode
                          ? 'border-axispurple-700/30 bg-[var(--surface-accent-subtle)] text-axispurple-700'
                          : 'border-black/12 bg-white text-black/55 hover:border-axispurple-700/30 hover:text-axispurple-700'
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
                  {!markovLoading && isRealData && topoSaveState === 'idle' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-sea-600">
                      <span className="w-2 h-2 rounded-full bg-sea-500" />
                      Ready · {markovStats?.nStates ?? existingNodes.length} nodes
                    </span>
                  )}
                  {topoSaveState === 'saving' && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-black/42">
                      <span className="w-2 h-2 rounded-full bg-black/20 animate-pulse" />
                      Saving layout…
                    </span>
                  )}
                  {topoSaveState === 'saved' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-sea-600">
                      <Check size={11} />
                      Layout saved
                    </span>
                  )}
                  {topoSaveState === 'error' && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                      <AlertCircle size={11} />
                      Save failed
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
                  <div className="hidden md:flex items-center gap-3 text-xs text-black/42">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: BRAND.violet }} /> Success</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Fail</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: BRAND.coral }} /> Retry</span>
                  </div>
                </div>
              </div>

              <div className="relative" style={{ height: 'clamp(360px, 60vw, 520px)' }}>
                {/* State A: loading */}
                {markovLoading && projectId && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--surface-page)]">
                    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BRAND.violet, borderTopColor: 'transparent' }} />
                    <span className="text-sm text-black/42">Building workflow graph...</span>
                  </div>
                )}

                {/* State B-pipeline: pipeline kicked off from TranscriptInput, job in flight */}
                {!markovLoading && !isRealData && projectId && inboundPipelineJobId && !pipelineInboundDone && !pipelineInboundFailed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--surface-page)]">
                    <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BRAND.violet, borderTopColor: 'transparent' }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-black">
                        {pipelineInboundJob?.current_step ?? 'Building your workflow…'}
                      </p>
                      <p className="text-xs text-black/42 mt-1">Generating telemetry, Markov matrix, and baseline simulation</p>
                    </div>
                    <div className="w-56 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(94,20,159,0.10)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pipelineInboundJob?.progress_pct ?? 0}%`,
                          background: `linear-gradient(90deg, ${BRAND.violet} 0%, ${BRAND.coral} 100%)`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* State B: pipeline not run yet (or failed) */}
                {!markovLoading && !isRealData && projectId && !(inboundPipelineJobId && !pipelineInboundDone && !pipelineInboundFailed) && (
                  editMode && rawTasks.length > 0 ? (
                    /* B2: edit mode — show scrollable node list */
                    <div className="absolute inset-0 overflow-y-auto bg-[var(--surface-page)] px-5 py-4">
                      <p className="text-xs text-black/42 mb-3">
                        {rawTasks.length} steps extracted from transcripts. Click <Pencil size={10} className="inline" /> to edit any step.
                      </p>
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                        {rawTasks.map((task) => {
                          const autoLabel = task.automatable_fraction === 'high' ? 'High automation' : task.automatable_fraction === 'medium' ? 'Med automation' : 'Low automation'
                          const autoCls = task.automatable_fraction === 'high' ? 'text-axispurple-900 bg-[var(--surface-accent-subtle)]' : task.automatable_fraction === 'medium' ? 'text-axispurple-700 bg-[#FCEAF4]' : 'text-axispurple-300 bg-[#FFE9EF]'
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
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-accent-subtle)] text-axispurple-900 font-medium">{t}</span>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-black/42">{Math.round(task.duration_distribution.mean_minutes)}min avg</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${autoCls}`}>{autoLabel}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenEdit(task.node_id)}
                                className="flex-shrink-0 p-1.5 rounded-full hover:bg-[var(--surface-accent-subtle)] transition-colors group"
                                title="Edit step"
                              >
                                <Pencil size={14} className="text-axispurple-900/40 group-hover:text-axispurple-900" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    /* B1: no edit mode — original empty state */
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--surface-page)]">
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
                          className="btn-primary px-4 py-2.5 text-sm"
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
                  <>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={handleNodesChange}
                      onEdgesChange={handleEdgesChange}
                      onConnect={handleConnect}
                      nodeTypes={nodeTypes}
                      nodesDraggable={editMode}
                      nodesConnectable={editMode}
                      elementsSelectable={editMode}
                      deleteKeyCode={editMode ? 'Backspace' : null}
                      fitView
                      fitViewOptions={{ padding: 0.3 }}
                      minZoom={0.3}
                      maxZoom={1.5}
                    >
                      <Controls />
                      <MiniMap
                        nodeColor={() => theme === 'dark' ? '#4A2575' : '#CFA3E2'}
                        maskColor={theme === 'dark' ? 'rgba(13,17,23,0.7)' : 'rgba(247,244,251,0.7)'}
                      />
                      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#1E2A40' : '#EADBF3'} />
                    </ReactFlow>
                    {/* Faded overlay while Markov data reloads after pipeline completes */}
                    {markovLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--surface-page)]/80 backdrop-blur-[2px]">
                        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BRAND.violet, borderTopColor: 'transparent' }} />
                        <span className="text-sm font-medium text-black/60">Refreshing graph…</span>
                      </div>
                    )}
                  </>
                )}

                {/* ── Edit panel ────────────────────────────────────────── */}
                {editingNodeId && editDraft && (
                  <div ref={editPanelRef} className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white border-l shadow-2xl flex flex-col z-10" style={{ borderColor: BRAND.border }}>
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
                          className="w-full border rounded-xl px-3 py-2 text-sm text-black focus-ring-accent"
                          style={{ borderColor: 'var(--border-accent)' }}
                        />
                      </div>

                      {/* Tools / app cluster */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Tools Used</label>
                        <input
                          value={editDraft.tools}
                          onChange={(e) => { setEditDraft((d) => d ? { ...d, tools: e.target.value } : d); setEditDirty(true) }}
                          placeholder="Salesforce, Slack, ..."
                          className="w-full border rounded-xl px-3 py-2 text-sm text-black focus-ring-accent"
                          style={{ borderColor: 'var(--border-accent)' }}
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
                          className="w-full border rounded-xl px-3 py-2 text-sm text-black focus-ring-accent"
                          style={{ borderColor: 'var(--border-accent)' }}
                        />
                      </div>

                      {/* Automatable fraction */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Automation Potential</label>
                        <select
                          value={editDraft.automatable_fraction}
                          onChange={(e) => { setEditDraft((d) => d ? { ...d, automatable_fraction: e.target.value } : d); setEditDirty(true) }}
                          className="w-full border rounded-xl px-3 py-2 text-sm text-black focus-ring-accent bg-white"
                          style={{ borderColor: 'var(--border-accent)' }}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>

                      {/* Role type */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Role Type</label>
                        <input
                          value={editDraft.role_type}
                          onChange={(e) => { setEditDraft((d) => d ? { ...d, role_type: e.target.value } : d); setEditDirty(true) }}
                          placeholder="e.g. SDR, AE, CSM, All"
                          className="w-full border rounded-xl px-3 py-2 text-sm text-black focus-ring-accent"
                          style={{ borderColor: 'var(--border-accent)' }}
                        />
                      </div>

                      {/* Workflow type */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-black/42 mb-1">Workflow Type</label>
                        <input
                          value={editDraft.workflow_type}
                          onChange={(e) => { setEditDraft((d) => d ? { ...d, workflow_type: e.target.value } : d); setEditDirty(true) }}
                          placeholder="e.g. outbound, closing, onboarding"
                          className="w-full border rounded-xl px-3 py-2 text-sm text-black focus-ring-accent"
                          style={{ borderColor: 'var(--border-accent)' }}
                        />
                      </div>

                      {editSaveError && (
                        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                          {editSaveError}
                        </div>
                      )}

                      {editSaveSuccess && (
                        <div className="flex items-start gap-2 rounded-xl bg-sea-50 border border-sea-500/30 px-3 py-2 text-xs text-sea-600">
                          <Check size={13} className="mt-0.5 flex-shrink-0" />
                          {editSaveSuccess}
                        </div>
                      )}

                      {editingNodePendingRequest && (
                        <div className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: '#F7DE9A', background: '#FFF9EA', color: '#9A6700' }}>
                          <Clock size={13} className="mt-0.5 flex-shrink-0" />
                          This step already has a pending change request from {new Date(editingNodePendingRequest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: BRAND.border }}>
                      <button
                        onClick={handleSaveEdit}
                        disabled={editSaving || !editDirty || !!editingNodePendingRequest}
                        className="btn-primary w-full justify-center px-4 py-2.5 text-sm rounded-2xl disabled:opacity-50"
                      >
                        {editSaving ? (
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <Check size={15} />
                        )}
                        {editSaving ? 'Submitting…' : 'Submit For Review'}
                      </button>
                      <p className="text-center text-[10px] text-black/38">Client edits stay pending until an admin approves them. Approved changes then update all_tasks.json.</p>
                    </div>
                  </div>
                )}

                {/* ── Comment panel ─────────────────────────────────────── */}
                {commentingNode && (
                  <div ref={commentPanelRef} className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white border-l shadow-2xl flex flex-col z-10" style={{ borderColor: BRAND.border }}>
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
                        <div key={c.id} className="bg-[var(--surface-page)] border rounded-2xl p-3 group" style={{ borderColor: BRAND.border }}>
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
                          className="flex-1 bg-[var(--surface-page)] border rounded-2xl px-3 py-2 text-sm resize-none transition-colors text-black placeholder:text-black/30 focus-ring-accent"
                          style={{ borderColor: 'var(--border-accent)' }}
                        />
                        <button onClick={handleSubmitComment} disabled={!commentText.trim()} className="btn-primary self-end p-2.5 rounded-2xl">
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
                <span className="text-xs text-black/38">{derivedToolList.length} tools</span>
              </div>

              {derivedToolList.length > 0 ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-black/34 font-semibold uppercase tracking-wide pb-1 border-b border-black/8">
                    <span>Tool</span>
                    <span className="text-right">Est. hrs/wk</span>
                  </div>
                  {derivedToolList.map((tool) => (
                    <div key={tool.name} className="grid grid-cols-2 gap-1 text-xs py-1.5 border-b border-black/6">
                      <span className="text-black/78 font-medium truncate">{tool.name}</span>
                      <span className="text-right text-black/42">{tool.weeklyHrs}h</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-black/34 mt-2">Derived from extracted workflow tasks</p>
                </div>
              ) : (
                <p className="rounded-2xl border border-black/8 bg-[#FBFAFD] px-4 py-6 text-center text-xs text-black/45">
                  Run the pipeline to generate your tool stack.
                </p>
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
                        ? navigate(`/projects/${projectId}/dashboard/simulations/${e.id}`)
                        : navigate(`/simulation?eval=${encodeURIComponent(e.id)}`)
                      }
                      className="group flex w-full items-center justify-between rounded-2xl border bg-[#FBFAFD] px-4 py-3 transition-colors hover:border-black/12"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-black">{e.tool_name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-black/42">
                          <span>{e.created_at.slice(0, 10)}</span>
                          {(e.status === 'queued' || e.status === 'running') && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-accent-subtle)] px-2 py-0.5 font-semibold text-axispurple-900">
                              <Loader2 size={10} className="animate-spin" />
                              Simulating…
                            </span>
                          )}
                          {e.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-500">
                              Failed
                            </span>
                          )}
                        </div>
                        {(e.status === 'queued' || e.status === 'running') && (
                          <div className="mt-1 text-[11px] text-black/45">
                            {e.latest_job_step ?? 'Queued'}{typeof e.latest_job_progress_pct === 'number' ? ` · ${e.latest_job_progress_pct}%` : ''}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-black/32" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>)}

        {activeTab !== 'workspace' && (
          <div data-gsap-dashboard-simulation className="space-y-5">
            {!selectedToolEval && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border bg-[var(--surface-page)] py-20 text-center" style={{ borderColor: BRAND.border }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(94,20,159,0.08)' }}>
                  <FileText size={26} style={{ color: BRAND.violet }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black">Simulation not found</p>
                  <p className="mt-1 text-xs text-black/42">Select a simulation from the dashboard list to open its tab.</p>
                </div>
              </div>
            )}

            {selectedToolEval && selectedSimulationLoading && (
              <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10" style={{ borderTopColor: BRAND.orchid }} />
              </div>
            )}

            {selectedToolEval && !selectedSimulation && (selectedToolEval.status === 'queued' || selectedToolEval.status === 'running') && (
              <div className="rounded-[24px] border bg-white p-6 space-y-4" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-black">{activeSimulationJob?.current_step ?? selectedToolEval.latest_job_step ?? 'Starting simulation…'}</p>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: BRAND.violet }}>{activeSimulationJob?.progress_pct ?? selectedToolEval.latest_job_progress_pct ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(94,20,159,0.10)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeSimulationJob?.progress_pct ?? selectedToolEval.latest_job_progress_pct ?? 0}%`,
                      background: `linear-gradient(90deg, ${BRAND.violet} 0%, ${BRAND.coral} 100%)`,
                    }}
                  />
                </div>
                <p className="text-xs text-black/42">You’re back in the workspace while Axis runs the analysis. This tab will fill in automatically once the simulation finishes.</p>
              </div>
            )}

            {selectedToolEval && selectedToolEval.status === 'failed' && !selectedSimulation && (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-5">
                <p className="text-sm font-semibold text-red-600">Simulation failed</p>
                <p className="mt-1 text-xs text-red-500">{selectedToolEval.last_error ?? activeSimulationJob?.error_message ?? 'An error occurred. Please try again from the Workspace tab.'}</p>
              </div>
            )}

            {selectedToolEval && selectedSimulation && selectedRecommendation && (
              <>
                <div className="flex items-center justify-between rounded-[18px] border bg-white px-5 py-4" style={{ borderColor: BRAND.border }}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Simulation</p>
                    <p className="mt-0.5 text-[22px] font-bold text-black">{selectedRecommendation.tool_name}</p>
                    <p className="mt-1 text-sm text-black/55">{selectedRecommendation.summary}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-[14px] border px-5 py-3 text-center" style={{ borderColor: 'rgba(94,20,159,0.15)', background: 'rgba(94,20,159,0.04)' }}>
                    <Award size={18} style={{ color: BRAND.violet }} />
                    <span className="text-2xl font-bold" style={{ color: BRAND.violet }}>{Math.round(selectedRecommendation.confidence_score * 100)}%</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-black/40">Confidence</span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border bg-white px-4 py-4" style={{ borderColor: 'rgba(94,20,159,0.12)' }}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>
                      <Clock size={12} /> Time Saved / Rep
                    </div>
                    <div className="mt-2 text-2xl font-bold text-black">
                      {Math.abs(selectedRecommendation.employee_impact.time_saved.p10).toFixed(1)}–{Math.abs(selectedRecommendation.employee_impact.time_saved.p70).toFixed(1)}
                      <span className="ml-1 text-sm font-normal text-black/40">hrs/wk</span>
                    </div>
                    <div className="mt-1 text-xs text-black/42">p10–p70 range across reps</div>
                  </div>
                  <div className="rounded-[18px] border bg-white px-4 py-4" style={{ borderColor: 'rgba(180,48,139,0.12)' }}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.orchid }}>
                      <Zap size={12} /> Throughput Lift
                    </div>
                    <div className="mt-2 text-2xl font-bold text-black">
                      {Math.abs(selectedRecommendation.company_impact.throughput.p10).toFixed(1)}–{Math.abs(selectedRecommendation.company_impact.throughput.p70).toFixed(1)}
                      <span className="ml-1 text-sm font-normal text-black/40">%</span>
                    </div>
                    <div className="mt-1 text-xs text-black/42">more deals closed per rep</div>
                  </div>
                  <div className="rounded-[18px] border bg-white px-4 py-4" style={{ borderColor: 'rgba(247,90,140,0.12)' }}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.coral }}>
                      <TrendingUp size={12} /> Revenue Impact
                    </div>
                    <div className="mt-2 text-2xl font-bold text-black">
                      ${(Math.abs(selectedRecommendation.company_impact.revenue_impact.p10) / 1000).toFixed(1)}k–${(Math.abs(selectedRecommendation.company_impact.revenue_impact.p70) / 1000).toFixed(1)}k
                    </div>
                    <div className="mt-1 text-xs text-black/42">projected uplift</div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="bg-white border rounded-[24px] overflow-hidden" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
                    <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
                      <BarChart3 size={16} style={{ color: BRAND.violet }} />
                      <span className="text-sm font-semibold text-black">Baseline Workflow</span>
                    </div>
                    <div style={{ height: 420 }}>
                      <ReactFlow
                        nodes={(baselineWorkflow ?? { nodes: nodes }).nodes}
                        edges={(baselineWorkflow ?? { edges: edges }).edges}
                        nodeTypes={nodeTypes}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        minZoom={0.3}
                        maxZoom={1.5}
                      >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#1E2A40' : '#EADBF3'} />
                      </ReactFlow>
                    </div>
                  </div>

                  <div className="bg-white border rounded-[24px] overflow-hidden" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
                    <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
                      <Zap size={16} style={{ color: BRAND.coral }} />
                      <span className="text-sm font-semibold text-black">With {selectedToolEval.tool_name}</span>
                    </div>
                    <div style={{ height: 420 }}>
                      <ReactFlow
                        nodes={(toolWorkflow ?? baselineWorkflow ?? { nodes: nodes }).nodes}
                        edges={(toolWorkflow ?? baselineWorkflow ?? { edges: edges }).edges}
                        nodeTypes={nodeTypes}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        minZoom={0.3}
                        maxZoom={1.5}
                      >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#1E2A40' : '#EADBF3'} />
                      </ReactFlow>
                    </div>
                  </div>
                </div>

                {selectedRecommendation.use_cases.length > 0 && (
                  <div className="bg-white border rounded-[24px] p-5" style={{ borderColor: BRAND.border }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: BRAND.violet }}>Key Use Cases</h3>
                    <div className="space-y-3">
                      {selectedRecommendation.use_cases.map((uc, i) => (
                        <div key={i} className="rounded-[16px] border bg-[var(--surface-page)] px-4 py-3" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
                          <p className="text-sm font-semibold text-black">{uc.title}</p>
                          <p className="mt-0.5 text-xs text-black/55">{uc.description}</p>
                        </div>
                      ))}
                    </div>
                    {projectId && (
                      <button
                        onClick={() => navigate(`/projects/${projectId}/recommendation/${selectedToolEval.id}`)}
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
          </div>
        )}

      </main>
      <CosmoChatWidget
        projectId={projectId}
        page={activeTab === 'workspace' ? 'dashboard' : 'simulation'}
        toolEvaluationId={selectedToolEval?.id ?? null}
        demoContext={!projectId ? cosmoDemoContext : undefined}
      />
    </ClientWorkspaceShell>
  )
}

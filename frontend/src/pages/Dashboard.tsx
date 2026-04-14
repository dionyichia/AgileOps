import { useState, useCallback, useRef, useEffect, useMemo, type MouseEvent } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useMarkovData } from '../hooks/pullMarkovData'
import { toolEvals as toolEvalsApi, projects as projectsApi } from '../api/client'
import type { ToolEvaluation, Project } from '../api/client'
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
  Briefcase,
  FileText,
  GitBranch,
} from 'lucide-react'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { roleStats as mockRoleStats, toolBuckets, type Tool } from '../data/mockData'
import { CLIENT_SIMULATIONS_SEED, type ClientSimulation } from '../data/clientSimulations'

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
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const { existingNodes, existingEdges, loading: markovLoading, error: markovError, isRealData, stats: markovStats } =
    useMarkovData(projectId)
  const [apiProject, setApiProject] = useState<Project | null>(null)
  const [apiToolEvals, setApiToolEvals] = useState<ToolEvaluation[] | null>(null)

  useEffect(() => {
    if (!projectId) return
    projectsApi.get(projectId).then(setApiProject).catch(() => {})
    toolEvalsApi.list(projectId).then(setApiToolEvals).catch(() => {})
  }, [projectId])

  const roleStats = apiProject
    ? {
        ...mockRoleStats,
        company: apiProject.company_name,
        primaryRole: apiProject.primary_role,
        teamSize: apiProject.team_size ?? mockRoleStats.numEmployees,
        numEmployees: apiProject.team_size ?? mockRoleStats.numEmployees,
      }
    : mockRoleStats

  const liveSimulations: ClientSimulation[] = useMemo(() => {
    if (projectId && apiToolEvals && apiToolEvals.length > 0) {
      return apiToolEvals.map((e) => ({
        id: e.id,
        toolName: e.tool_name,
        status: 'completed' as const,
        timeSaved: '—',
        date: e.created_at.slice(0, 10),
      }))
    }
    return CLIENT_SIMULATIONS_SEED
  }, [projectId, apiToolEvals])

  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  /** Salesforce-style console: baseline workspace vs simulation snapshot tabs */
  const [activeViewId, setActiveViewId] = useState<string>('baseline')
  const [openSimTabIds, setOpenSimTabIds] = useState<string[]>(() =>
    CLIENT_SIMULATIONS_SEED.map((s) => s.id),
  )

  const projectTabsSeededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!projectId || !apiToolEvals?.length) return
    if (projectTabsSeededFor.current === projectId) return
    projectTabsSeededFor.current = projectId
    const apiIds = apiToolEvals.map((e) => e.id)
    setOpenSimTabIds((prev) => {
      // Merge: keep any IDs already open (e.g. from navigation state), add API-sourced ones
      const extra = prev.filter((id) => !apiIds.includes(id))
      return [...apiIds, ...extra]
    })
  }, [projectId, apiToolEvals])

  /** On arrival from ToolInputForm: open and focus the newly-created simulation tab */
  useEffect(() => {
    const openTab = (location.state as { openTab?: string } | null)?.openTab
    if (!openTab) return
    setOpenSimTabIds((prev) => (prev.includes(openTab) ? prev : [...prev, openTab]))
    setActiveViewId(openTab)
    // Clear state so a refresh doesn't re-trigger
    navigate(location.pathname, { replace: true, state: {} })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeSimulation = useMemo(
    () => liveSimulations.find((s) => s.id === activeViewId),
    [liveSimulations, activeViewId],
  )

  /** Other runs only: hide the simulation you’re currently viewing in the console */
  const recentSimulationsForList = useMemo(() => {
    if (activeViewId === 'baseline') return liveSimulations
    return liveSimulations.filter((s) => s.id !== activeViewId)
  }, [activeViewId, liveSimulations])

  const focusSimulationTab = useCallback((simId: string) => {
    setOpenSimTabIds((prev) => (prev.includes(simId) ? prev : [...prev, simId]))
    setActiveViewId(simId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const closeSimTab = (e: MouseEvent, id: string) => {
    e.stopPropagation()
    setOpenSimTabIds((prev) => prev.filter((x) => x !== id))
    if (activeViewId === id) setActiveViewId('baseline')
  }

  /** Deep link / back from recommendation: `?tab=<simulationId>` selects that console tab */
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!tab) return
    const valid = liveSimulations.some((s) => s.id === tab)
    const basePath = projectId ? `/projects/${projectId}/dashboard` : '/dashboard'
    if (!valid) {
      navigate(basePath, { replace: true })
      return
    }
    setActiveViewId(tab)
    setOpenSimTabIds((prev) => (prev.includes(tab) ? prev : [...prev, tab]))
    navigate(basePath, { replace: true })
  }, [searchParams, navigate, liveSimulations, projectId])

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

  // ── Nodes with comment handlers ──────────────────────────────────────────
  const nodesWithComments = useMemo(
    () =>
      existingNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          nodeId: node.id,
          commentCount: (comments[node.id] ?? []).length,
          onComment: handleOpenComment,
        },
      })),
    [existingNodes, comments, handleOpenComment],
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
          {activeViewId === 'baseline' ? (
            <p className="mt-2 text-[20px] leading-snug text-black/88">
              Your team&apos;s current workflow overview and tool insights
            </p>
          ) : (
            <p className="mt-2 text-[18px] leading-snug text-black/78">
              <span className="font-semibold text-[#5E149F]">Simulation:</span>{' '}
              {activeSimulation?.toolName ?? 'Unknown'}{' '}
              <span className="text-black/45">
                ·{' '}
                {activeSimulation &&
                  new Date(activeSimulation.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
              </span>
              {activeSimulation && (
                <span className="text-black/45"> · Est. {activeSimulation.timeSaved}</span>
              )}
            </p>
          )}
        </div>
      }
    >
      <main className="mx-auto w-full max-w-[1480px] flex-1 space-y-5 px-6 py-5 md:px-10 md:py-6">
        {/* Salesforce-style console tabs: baseline + open simulation views */}
        <div className="-mx-6 border-t-2 md:-mx-10" style={{ borderColor: BRAND.violet }}>
          <div
            className="flex min-h-[44px] overflow-x-auto border-b-2 bg-white"
            style={{ borderBottomColor: 'rgba(94, 20, 159, 0.22)' }}
          >
            <button
              type="button"
              onClick={() => setActiveViewId('baseline')}
              className={`flex shrink-0 items-center gap-2 border-r border-black/10 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                activeViewId === 'baseline'
                  ? 'bg-[#F4E8FB] text-[#5E149F]'
                  : 'bg-white text-black/70 hover:bg-black/[0.02]'
              }`}
              style={activeViewId === 'baseline' ? { boxShadow: 'inset 0 -3px 0 0 #5E149F' } : undefined}
            >
              <LayoutDashboard size={15} className="shrink-0 text-black/50" />
              <span className="whitespace-nowrap">Workspace</span>
            </button>
            {openSimTabIds.map((simId) => {
              const sim = liveSimulations.find((s) => s.id === simId)
              if (!sim) return null
              const active = activeViewId === simId
              return (
                <div
                  key={simId}
                  className="flex shrink-0 items-stretch border-r border-black/10"
                >
                  <button
                    type="button"
                    onClick={() => setActiveViewId(simId)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                      active ? 'bg-[#F4E8FB] text-[#5E149F]' : 'bg-white text-black/72 hover:bg-black/[0.02]'
                    }`}
                    style={active ? { boxShadow: 'inset 0 -3px 0 0 #5E149F' } : undefined}
                  >
                    <Briefcase size={14} className="shrink-0 text-black/45" />
                    <span className="max-w-[160px] truncate">{sim.toolName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => closeSimTab(e, simId)}
                    className="flex items-center px-2 text-black/35 transition-colors hover:bg-black/[0.06] hover:text-black/65"
                    aria-label={`Close ${sim.toolName} tab`}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
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

          {/* ── Workflow map card ───────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-end px-1">
              <button
                type="button"
                onClick={() => {
                  if (activeViewId === 'baseline') {
                    navigate(projectId ? `/projects/${projectId}/tool-input` : '/toolinput')
                  } else {
                    navigate(
                      projectId
                        ? `/projects/${projectId}/recommendation/${activeViewId}`
                        : `/recommendation?eval=${encodeURIComponent(activeViewId)}`,
                    )
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_28px_rgba(94,20,159,0.28)] transition-transform hover:-translate-y-0.5 axis-gradient-button"
              >
                {activeViewId === 'baseline' ? (
                  <>
                    <Plus size={16} strokeWidth={2.5} />
                    Add new tool
                  </>
                ) : (
                  <>
                    <FileText size={16} strokeWidth={2.5} />
                    View Report
                  </>
                )}
              </button>
            </div>
          <div className="bg-white border rounded-[24px] overflow-hidden" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(94,20,159,0.08)' }}>
              <div className="flex items-center gap-3">
                <BarChart3 size={16} style={{ color: BRAND.violet }} />
                <div>
                  <span className="text-sm font-semibold text-black">Workflow Map</span>
                  {isRealData && (
                    <span className="ml-2 text-xs text-black/42">
                      Click <MessageSquare size={10} className="inline" /> on any step to leave feedback
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#F7F4FB]">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(94,20,159,0.08)' }}>
                    <GitBranch size={24} style={{ color: BRAND.violet }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-black">No workflow data yet</p>
                    <p className="text-xs text-black/42 mt-1">Submit transcripts and run the pipeline to generate your workflow graph.</p>
                  </div>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/transcripts`)}
                    className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-colors"
                    style={{ background: `linear-gradient(90deg, ${BRAND.violet} 0%, ${BRAND.coral} 100%)` }}
                  >
                    <ChevronRight size={15} />
                    Go to Transcripts
                  </button>
                </div>
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
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Recent Simulations</h3>
                <span className="text-xs text-black/38">
                  {recentSimulationsForList.length}{' '}
                  {recentSimulationsForList.length === 1 ? 'run' : 'runs'}
                </span>
              </div>

              <div className="space-y-2">
                {recentSimulationsForList.length === 0 ? (
                  <p className="rounded-2xl border border-black/8 bg-[#FBFAFD] px-4 py-6 text-center text-xs text-black/45">
                    No other simulations to show while this tab is open.
                  </p>
                ) : (
                  recentSimulationsForList.map((sim) => (
                    <button
                      key={sim.id}
                      type="button"
                      onClick={() =>
                        projectId
                          ? navigate(`/projects/${projectId}/simulation/${sim.id}`)
                          : focusSimulationTab(sim.id)
                      }
                      className="group flex w-full items-center justify-between rounded-2xl border bg-[#FBFAFD] px-4 py-3 transition-colors hover:border-black/12"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-black transition-colors">{sim.toolName}</div>
                        <div className="mt-0.5 text-xs text-black/42">
                          {new Date(sim.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="flex items-center justify-end gap-1 text-sm font-semibold text-sea-300">
                            <TrendingUp size={12} />
                            {sim.timeSaved}
                          </div>
                          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusBadge[sim.status]}`}>
                            {sim.status}
                          </span>
                        </div>
                        <ChevronRight size={14} className="text-black/32" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => navigate('/simulations')}
                className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-2xl transition-colors"
                style={{ color: BRAND.violet, background: 'rgba(94,20,159,0.08)', border: '1px solid rgba(94,20,159,0.14)' }}
              >
                View all simulations
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

        </main>
    </ClientWorkspaceShell>
  )
}

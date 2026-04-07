import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  LayoutDashboard,
  GitBranch,
  Wrench,
  FlaskConical,
  FileBarChart,
  LogOut,
  MessageSquare,
  X,
  Send,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { roleStats as mockRoleStats, toolBuckets, existingNodes as mockNodes, existingEdges as mockEdges } from '../data/mockData'
import type { Tool } from '../data/mockData'

// ── Types ────────────────────────────────────────────────────────────────────

interface NodeComment {
  id: string
  text: string
  createdAt: string
}

interface SimulationRun {
  id: string
  toolName: string
  status: 'completed' | 'running' | 'failed'
  timeSaved: string
  date: string
}

// ── Mock data for new cards ──────────────────────────────────────────────────

const mockSimulations: SimulationRun[] = [
  { id: 's1', toolName: 'Salesforce', status: 'completed', timeSaved: '4.1 hrs/wk', date: '2026-03-22' },
  { id: 's2', toolName: 'Outreach', status: 'completed', timeSaved: '2.3 hrs/wk', date: '2026-03-20' },
  { id: 's3', toolName: 'Gong.io', status: 'completed', timeSaved: '1.8 hrs/wk', date: '2026-03-18' },
]

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

// ── Sidebar nav items ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  { id: 'workflow',    label: 'Workflow',      icon: GitBranch },
  { id: 'tools',       label: 'Tools',         icon: Wrench },
  { id: 'simulations', label: 'Simulations',   icon: FlaskConical },
  { id: 'reports',     label: 'Reports',       icon: FileBarChart },
]

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

  // ── API data (project-scoped routes only) ────────────────────────────────
  const { existingNodes, existingEdges, loading: markovLoading, error: markovError, isRealData, stats: markovStats } = useMarkovData(projectId)
  const [apiProject, setApiProject]     = useState<Project | null>(null)
  const [apiToolEvals, setApiToolEvals] = useState<ToolEvaluation[] | null>(null)

  useEffect(() => {
    if (!projectId) return
    projectsApi.get(projectId).then(setApiProject).catch(() => {/* use mock */})
    toolEvalsApi.list(projectId).then(setApiToolEvals).catch(() => {/* use mock */})
  }, [projectId])

  // Merge API data with mock fallbacks
  const roleStats = apiProject
    ? {
        ...mockRoleStats,
        company:    apiProject.company_name,
        primaryRole: apiProject.primary_role,
        teamSize:   apiProject.team_size ?? mockRoleStats.numEmployees,
        numEmployees: apiProject.team_size ?? mockRoleStats.numEmployees,
      }
    : mockRoleStats

  const liveSimulations: SimulationRun[] = apiToolEvals
    ? apiToolEvals.map((e) => ({
        id:        e.id,
        toolName:  e.tool_name,
        status:    'completed' as const,   // ToolEvaluation has no status field; default to completed
        timeSaved: '—',
        date:      e.created_at.slice(0, 10),
      }))
    : mockSimulations

  const [activeNav, setActiveNav] = useState('overview')
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

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
  const totalComments = Object.values(comments).reduce((sum, arr) => sum + arr.length, 0)
  const allCommentsList = Object.entries(comments).flatMap(([nodeId, cmts]) =>
    cmts.map((c) => ({ ...c, nodeId })),
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
      navigate('/simulation')
    }
  }

  // ── Scroll to section when nav clicked ───────────────────────────────────
  const workflowRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const simulationsRef = useRef<HTMLDivElement>(null)

  const handleNavClick = (id: string) => {
    setActiveNav(id)
    const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
      workflow: workflowRef,
      tools: toolsRef,
      simulations: simulationsRef,
    }
    if (id === 'reports') {
      navigate('/recommendation')
      return
    }
    refMap[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-[#F7F4FB] flex">

      {/* ── Left sidebar ───────────────────────────────────────────────────── */}
      <aside
        className="w-64 flex-shrink-0 border-r flex flex-col sticky top-0 h-screen bg-white"
        style={{ borderColor: BRAND.border }}
      >
        {/* Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
            <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-colors ${
                activeNav === id
                  ? 'text-white'
                  : 'text-black/58 hover:bg-black/[0.03] hover:text-black/88'
              }`}
              style={activeNav === id ? { background: 'linear-gradient(90deg, #5E149F 0%, #B4308B 50%, #F75A8C 100%)', boxShadow: '0 12px 24px rgba(94,20,159,0.16)' } : {}}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-6">
          <div className="pt-4 mb-3" style={{ borderTop: `1px solid ${BRAND.border}` }}>
            <div className="flex items-center gap-3 px-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ background: 'linear-gradient(180deg, #5E149F 0%, #F75A8C 100%)' }}
              >
                AC
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-black truncate">Acme Corp</div>
                <div className="text-xs text-black/42 truncate">{roleStats.teamType} · {roleStats.role.split('(')[0].trim()}</div>
              </div>
            </div>
          </div>
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px] font-semibold text-black/46 hover:bg-black/[0.03] hover:text-black/78 transition-colors">
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* ── Top header ─────────────────────────────────────────────────── */}
        <header
          className="border-b bg-white/90 backdrop-blur-sm sticky top-0 z-40 px-8 py-5 flex items-center justify-between"
          style={{ borderColor: BRAND.border }}
        >
          <div>
            <h1 className="text-[36px] font-bold tracking-[-0.04em] text-black">Dashboard</h1>
            <p className="text-[14px] text-black/48 mt-1">Your team&apos;s workflow overview and tool insights</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-5 text-[14px] text-black/50 font-medium">
              <span className="flex items-center gap-1.5">
                <Users size={14} style={{ color: BRAND.violet }} />
                {roleStats.numEmployees} reps
              </span>
              <span className="flex items-center gap-1.5">
                <Layers size={14} style={{ color: BRAND.pink }} />
                {roleStats.avgToolsUsed} tools avg
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} style={{ color: BRAND.coral }} />
                {roleStats.avgWeeklyHours}h/wk
              </span>
            </div>
          </div>
        </header>

        {/* ── Scrollable content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#F7F4FB]">

          {/* ── Stat cards row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-[24px] p-5 bg-white border" style={{ borderColor: 'rgba(94,20,159,0.12)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.violet }}>Workflow Steps</div>
              <div className="text-3xl font-bold text-black">{taskNodes.length}</div>
              <div className="text-xs text-black/42 mt-1">{totalMinutes} min total cycle</div>
            </div>
            <div className="rounded-[24px] p-5 bg-white border" style={{ borderColor: 'rgba(180,48,139,0.12)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.orchid }}>Avg Utilization</div>
              <div className="text-3xl font-bold text-black">{avgUtilization}%</div>
              <div className="w-full rounded-full h-1.5 mt-2 bg-black/10">
                <div className="h-1.5 rounded-full" style={{ width: `${avgUtilization}%`, background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }} />
              </div>
            </div>
            <div className="rounded-[24px] p-5 bg-white border" style={{ borderColor: 'rgba(226,64,155,0.14)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.pink }}>Unused Features</div>
              <div className="text-3xl font-bold text-black">{totalUnusedFeatures}</div>
              <div className="text-xs text-black/42 mt-1">across {allTools.length} tools</div>
            </div>
            <div className="rounded-[24px] p-5 bg-white border" style={{ borderColor: 'rgba(247,90,140,0.14)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.coral }}>Team Size</div>
              <div className="text-3xl font-bold text-black">{roleStats.numEmployees}</div>
              <div className="text-xs text-black/42 mt-1">{roleStats.role.split('(')[0].trim()}s</div>
            </div>
          </div>

          {/* ── Workflow map card ───────────────────────────────────────── */}
          <div ref={workflowRef} className="bg-white border rounded-[24px] overflow-hidden" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
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

          {/* ── Bottom grid: Tools + Simulations + Feedback ────────────── */}
          <div className="grid grid-cols-3 gap-4">

            {/* ── Tool Stack card ──────────────────────────────────────── */}
            <div ref={toolsRef} className="bg-white border rounded-[24px] p-5 max-h-[520px] overflow-y-auto" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
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
            <div ref={simulationsRef} className="bg-white border rounded-[24px] p-5" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Recent Simulations</h3>
                <span className="text-xs text-black/38">{liveSimulations.length} runs</span>
              </div>

              <div className="space-y-2">
                {liveSimulations.map((sim) => (
                  <button
                    key={sim.id}
                    onClick={() => projectId
                      ? navigate(`/projects/${projectId}/simulation/${sim.id}`)
                      : navigate('/simulation')
                    }
                    className="w-full flex items-center justify-between bg-[#FBFAFD] border rounded-2xl px-4 py-3 transition-colors group"
                    style={{ borderColor: BRAND.border }}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium text-black transition-colors">{sim.toolName}</div>
                      <div className="text-xs text-black/42 mt-0.5">
                        {new Date(sim.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="text-sm font-semibold text-sea-300 flex items-center gap-1">
                          <TrendingUp size={12} />
                          {sim.timeSaved}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadge[sim.status]}`}>
                          {sim.status}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-black/32" />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => navigate('/simulation')}
                className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-2xl transition-colors"
                style={{ color: BRAND.violet, background: 'rgba(94,20,159,0.08)', border: '1px solid rgba(94,20,159,0.14)' }}
              >
                View all simulations
                <ChevronRight size={14} />
              </button>
            </div>

            {/* ── Feedback summary card ────────────────────────────────── */}
            <div className="bg-white border rounded-[24px] p-5" style={{ borderColor: BRAND.border, boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.violet }}>Feedback</h3>
                {totalComments > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: BRAND.violet, background: 'rgba(94,20,159,0.08)' }}>
                    {totalComments} comment{totalComments !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {allCommentsList.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare size={24} className="mx-auto mb-2" style={{ color: BRAND.violet }} />
                  <p className="text-sm text-black/52">No feedback yet</p>
                  <p className="text-xs text-black/38 mt-1">Click the comment icon on any workflow step to leave feedback</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {allCommentsList.slice(0, 8).map((c) => {
                    const nodeLabel = existingNodes.find((n) => n.id === c.nodeId)?.data?.label ?? c.nodeId
                    return (
                      <div key={c.id} className="bg-[#FBFAFD] border rounded-2xl px-3 py-2.5" style={{ borderColor: BRAND.border }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: BRAND.violet }}>{nodeLabel}</span>
                          <span className="text-[10px] text-black/38">
                            {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-xs text-black/72 leading-relaxed line-clamp-2">{c.text}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}

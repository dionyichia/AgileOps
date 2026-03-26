import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Zap,
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
import { roleStats, toolBuckets, existingNodes, existingEdges } from '../data/mockData'
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

// ── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
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
    [comments, handleOpenComment],
  )

  const [nodes, , onNodesChange] = useNodesState(nodesWithComments)
  const [edges, , onEdgesChange] = useEdgesState(existingEdges)

  useEffect(() => {
    onNodesChange(
      nodesWithComments.map((n) => ({ type: 'reset' as const, item: n })),
    )
  }, [nodesWithComments])

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
  const totalMinutes = taskNodes.reduce((sum, n) => sum + (n.data.minutes ?? 0), 0)

  const commentingNodeLabel = commentingNode
    ? existingNodes.find((n) => n.id === commentingNode)?.data?.label ?? commentingNode
    : ''

  const handleRunSimulation = (toolName: string) => {
    localStorage.setItem('axisToolInput', JSON.stringify({ useCase: 'adoption', toolName }))
    navigate('/simulation')
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
    <div className="min-h-screen bg-[#080C18] flex">

      {/* ── Left sidebar ───────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-[#0B0F1E] flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cerulean flex items-center justify-center">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-xl tracking-tight">axis</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === id
                  ? 'bg-cerulean-500/15 text-cerulean-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-6">
          <div className="border-t border-slate-800 pt-4 mb-3">
            <div className="flex items-center gap-3 px-3">
              <div className="w-8 h-8 rounded-full bg-cerulean/30 border border-cerulean-500/30 flex items-center justify-center text-cerulean-300 text-xs font-semibold">
                AC
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">Acme Corp</div>
                <div className="text-xs text-slate-500 truncate">{roleStats.teamType} · {roleStats.role.split('(')[0].trim()}</div>
              </div>
            </div>
          </div>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors">
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* ── Top header ─────────────────────────────────────────────────── */}
        <header className="border-b border-slate-800 bg-[#0B0F1E]/90 backdrop-blur-sm sticky top-0 z-40 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Your team's workflow overview and tool insights</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users size={12} className="text-cerulean" />
                {roleStats.numEmployees} reps
              </span>
              <span className="flex items-center gap-1.5">
                <Layers size={12} className="text-magenta" />
                {roleStats.avgToolsUsed} tools avg
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-gold" />
                {roleStats.avgWeeklyHours}h/wk
              </span>
            </div>
          </div>
        </header>

        {/* ── Scrollable content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* ── Stat cards row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-cerulean/15 border border-cerulean-500/30 rounded-xl p-5">
              <div className="text-xs font-bold text-cerulean-300 uppercase tracking-widest mb-1">Workflow Steps</div>
              <div className="text-3xl font-bold text-white">{taskNodes.length}</div>
              <div className="text-xs text-slate-500 mt-1">{totalMinutes} min total cycle</div>
            </div>
            <div className="bg-gold/10 border border-gold-500/30 rounded-xl p-5">
              <div className="text-xs font-bold text-gold-300 uppercase tracking-widest mb-1">Avg Utilization</div>
              <div className="text-3xl font-bold text-white">{avgUtilization}%</div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full ${avgUtilization < 50 ? 'bg-gold' : 'bg-sea'}`} style={{ width: `${avgUtilization}%` }} />
              </div>
            </div>
            <div className="bg-magenta/10 border border-magenta-500/30 rounded-xl p-5">
              <div className="text-xs font-bold text-magenta-300 uppercase tracking-widest mb-1">Unused Features</div>
              <div className="text-3xl font-bold text-white">{totalUnusedFeatures}</div>
              <div className="text-xs text-slate-500 mt-1">across {allTools.length} tools</div>
            </div>
            <div className="bg-sea/10 border border-sea-500/30 rounded-xl p-5">
              <div className="text-xs font-bold text-sea-300 uppercase tracking-widest mb-1">Team Size</div>
              <div className="text-3xl font-bold text-white">{roleStats.numEmployees}</div>
              <div className="text-xs text-slate-500 mt-1">{roleStats.role.split('(')[0].trim()}s</div>
            </div>
          </div>

          {/* ── Workflow map card ───────────────────────────────────────── */}
          <div ref={workflowRef} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <BarChart3 size={16} className="text-cerulean" />
                <div>
                  <span className="text-sm font-semibold text-slate-200">Workflow Map</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Click <MessageSquare size={10} className="inline" /> on any step to leave feedback
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-sea inline-block rounded" /> Success</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Fail</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gold inline-block rounded" /> Retry</span>
              </div>
            </div>

            <div className="relative" style={{ height: 520 }}>
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
                <MiniMap nodeColor={() => '#1E2D4A'} maskColor="rgba(8,12,24,0.7)" />
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1E2D4A" />
              </ReactFlow>

              {/* ── Comment panel ─────────────────────────────────────── */}
              {commentingNode && (
                <div className="absolute top-0 right-0 h-full w-80 bg-[#0F1629] border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Feedback</div>
                      <div className="text-sm font-semibold text-white truncate">{commentingNodeLabel}</div>
                    </div>
                    <button onClick={() => setCommentingNode(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {(comments[commentingNode] ?? []).length === 0 && (
                      <p className="text-xs text-slate-600 text-center py-6">No feedback yet. Something look off? Let us know below.</p>
                    )}
                    {(comments[commentingNode] ?? []).map((c) => (
                      <div key={c.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 group">
                        <p className="text-sm text-slate-200 leading-relaxed">{c.text}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-slate-600">
                            {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <button onClick={() => handleDeleteComment(commentingNode, c.id)} className="text-[10px] text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-slate-800">
                    <div className="flex gap-2">
                      <textarea
                        ref={commentInputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment() } }}
                        placeholder="What needs to change here?"
                        rows={2}
                        className="flex-1 bg-[#111827] border border-slate-700 focus:border-cerulean focus:outline-none text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm resize-none transition-colors"
                      />
                      <button onClick={handleSubmitComment} disabled={!commentText.trim()} className="self-end p-2.5 bg-cerulean hover:bg-cerulean-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors">
                        <Send size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">Press Enter to send</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom grid: Tools + Simulations + Feedback ────────────── */}
          <div className="grid grid-cols-3 gap-4">

            {/* ── Tool Stack card ──────────────────────────────────────── */}
            <div ref={toolsRef} className="bg-[#111827] border border-slate-800 rounded-xl p-5 max-h-[520px] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tool Stack</h3>
                <span className="text-xs text-slate-600">{avgUtilization}% avg utilization</span>
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
                              className="w-full text-left px-2.5 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-all"
                            >
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-medium">{tool.name}</span>
                                <span className={`font-semibold ${tool.utilization < 40 ? 'text-gold-300' : tool.utilization < 60 ? 'text-slate-400' : 'text-sea-300'}`}>
                                  {tool.utilization}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-700 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full transition-all ${tool.utilization < 40 ? 'bg-gold' : tool.utilization < 60 ? 'bg-cerulean' : 'bg-sea'}`}
                                  style={{ width: `${tool.utilization}%` }}
                                />
                              </div>
                              {unusedCount > 0 && (
                                <div className="text-[10px] text-slate-600 mt-1">{unusedCount} unused feature{unusedCount !== 1 ? 's' : ''}</div>
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
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-3 transition-colors"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                    Back to all tools
                  </button>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white">{selectedToolData.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${selectedToolData.utilization < 40 ? 'bg-gold-500/15 text-gold-300' : 'bg-sea-500/15 text-sea-300'}`}>
                      {selectedToolData.utilization}% utilized
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4">
                    <div
                      className={`h-1.5 rounded-full ${selectedToolData.utilization < 40 ? 'bg-gold' : selectedToolData.utilization < 60 ? 'bg-cerulean' : 'bg-sea'}`}
                      style={{ width: `${selectedToolData.utilization}%` }}
                    />
                  </div>

                  {/* Used features */}
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Using</div>
                  <div className="space-y-1.5 mb-4">
                    {selectedToolData.features.filter((f) => f.used).map((f) => (
                      <div key={f.name} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-sea-500/5 border border-sea-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-sea mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-slate-300">{f.name}</div>
                          <div className="text-[10px] text-slate-600">{f.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Unused features */}
                  <div className="text-[10px] font-bold text-gold-300 uppercase tracking-widest mb-2">Not Using</div>
                  <div className="space-y-1.5 mb-4">
                    {selectedToolData.features.filter((f) => !f.used).map((f) => (
                      <div key={f.name} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-gold-500/5 border border-gold-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-slate-300">{f.name}</div>
                          <div className="text-[10px] text-slate-600">{f.description}</div>
                          {f.workflowStep && (
                            <div className="text-[10px] text-cerulean-300 mt-0.5">
                              Could save ~{f.potentialTimeSaved}min at "{f.workflowStep}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleRunSimulation(selectedToolData.name)}
                    className="w-full flex items-center justify-center gap-2 bg-cerulean hover:bg-cerulean-400 text-white px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors"
                  >
                    <Play size={13} />
                    Simulate Full Adoption
                  </button>
                </div>
              )}
            </div>

            {/* ── Recent Simulations card ──────────────────────────────── */}
            <div ref={simulationsRef} className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Simulations</h3>
                <span className="text-xs text-slate-600">{mockSimulations.length} runs</span>
              </div>

              <div className="space-y-2">
                {mockSimulations.map((sim) => (
                  <button
                    key={sim.id}
                    onClick={() => navigate('/simulation')}
                    className="w-full flex items-center justify-between bg-[#0B0F1E] border border-slate-800 rounded-lg px-4 py-3 hover:border-slate-700 transition-colors group"
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium text-white group-hover:text-cerulean-300 transition-colors">{sim.toolName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
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
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => navigate('/simulation')}
                className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-cerulean hover:text-cerulean-300 bg-cerulean-500/10 border border-cerulean-500/20 hover:border-cerulean-500/40 px-4 py-2.5 rounded-lg transition-colors"
              >
                View all simulations
                <ChevronRight size={14} />
              </button>
            </div>

            {/* ── Feedback summary card ────────────────────────────────── */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Feedback</h3>
                {totalComments > 0 && (
                  <span className="text-xs font-medium text-gold bg-gold-500/10 px-2 py-0.5 rounded-full">
                    {totalComments} comment{totalComments !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {allCommentsList.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare size={24} className="mx-auto mb-2 text-slate-700" />
                  <p className="text-sm text-slate-500">No feedback yet</p>
                  <p className="text-xs text-slate-600 mt-1">Click the comment icon on any workflow step to leave feedback</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {allCommentsList.slice(0, 8).map((c) => {
                    const nodeLabel = existingNodes.find((n) => n.id === c.nodeId)?.data?.label ?? c.nodeId
                    return (
                      <div key={c.id} className="bg-[#0B0F1E] border border-slate-800 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-cerulean-300 uppercase tracking-wide">{nodeLabel}</span>
                          <span className="text-[10px] text-slate-600">
                            {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{c.text}</p>
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

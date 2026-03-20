import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Connection,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Users, Clock, Plus, Layers } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import { nodeTypes } from '../components/workflow/CustomNodes'
// import { roleStats, toolBuckets, existingNodes, existingEdges } from '../data/mockData'
import { roleStats, toolBuckets } from '../data/mockData'

 import { useMarkovData } from '../hooks/pullMarkovData'

const bucketColorMap: Record<string, string> = {
  indigo:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  violet:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  cyan:    'bg-cyan-500/15  text-cyan-300  border-cyan-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose:    'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

const intensityDot: Record<string, string> = {
  High:   'bg-emerald-400',
  Medium: 'bg-amber-400',
  Low:    'bg-red-400',
}

export default function WorkflowReport() {
  const { existingNodes, existingEdges, loading, error } = useMarkovData()

  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState(existingNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(existingEdges)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  // if (loading) {
  //   return <div className="text-slate-400 p-6">Loading workflow...</div>
  // }

  // if (error) {
  //   return <div className="text-red-400 p-6">Failed to load workflow</div>
  // }

  console.log(existingNodes)
  console.log(existingEdges)

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            style: { stroke: '#10B981', strokeWidth: 2 },
            label: '?%',
            labelStyle: { fill: '#10B981', fontWeight: 700, fontSize: 11 },
            labelBgStyle: { fill: '#0F1629', fillOpacity: 0.9 },
            labelBgPadding: [4, 8] as [number, number],
          },
          eds,
        ),
      ),
    [setEdges],
  )

  const addTask = () => {
    const newNode = {
      id: `task-${Date.now()}`,
      type: 'taskNode',
      position: { x: 50 + Math.random() * 200, y: 100 + Math.random() * 300 },
      data: { label: 'New Task', tools: ['Tool'], minutes: 20, automatable: 'medium' as const },
    }
    setNodes((nds) => [...nds, newNode])
  }

  // All tools flat for the popular-tools table
  const allTools = toolBuckets.flatMap((b) => b.tools)
  const topTools = [...allTools].sort((a, b) => b.hoursPerWeek - a.hoursPerWeek).slice(0, 6)

  useEffect(() => {
    if (existingNodes.length) {
      setNodes(existingNodes)
    }
  }, [existingNodes])

  useEffect(() => {
    if (existingEdges.length) {
      setEdges(existingEdges)
    }
  }, [existingEdges])

  return (
    <StepLayout
      currentStep={2}
      title="Existing Workflow Report"
      subtitle="Your team's current workflow, tool stack, and process flow — based on telemetry and role data."
      onNext={() => navigate('/tool-input')}
      nextLabel="Analyze New Tool"
    >
      <div className="flex gap-6 h-full">

        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-5 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">

          {/* Role Stats */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Role Stats</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Type of team</span>
                <span className="text-xs font-semibold text-white bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded">{roleStats.teamType}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-xs text-slate-500">Role</span>
                <span className="text-xs font-medium text-slate-200 text-right max-w-[160px] leading-snug">{roleStats.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Users size={11} /> Employees</span>
                <span className="text-sm font-bold text-white">{roleStats.numEmployees}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Layers size={11} /> Avg tools used</span>
                <span className="text-sm font-bold text-white">{roleStats.avgToolsUsed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={11} /> Avg weekly hrs</span>
                <span className="text-sm font-bold text-white">{roleStats.avgWeeklyHours}h</span>
              </div>
            </div>
          </div>

          {/* Tool Stack */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tool Stack</h3>
            <div className="space-y-4">
              {toolBuckets.map((bucket) => (
                <div key={bucket.category}>
                  <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${bucketColorMap[bucket.color]}`}>
                    {bucket.category}
                  </span>
                  <div className="mt-2 space-y-1.5 pl-1">
                    {bucket.tools.map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => setSelectedTool(tool.name === selectedTool ? null : tool.name)}
                        className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg transition-all ${
                          selectedTool === tool.name
                            ? 'bg-indigo-500/15 text-indigo-300'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-slate-500">{tool.pctUsers}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular tools table */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Popular Tools</h3>
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-600 font-semibold uppercase tracking-wide pb-1 border-b border-slate-800">
                <span>Tool</span>
                <span className="text-center">% using</span>
                <span className="text-right">Intensity</span>
              </div>
              {topTools.map((tool) => (
                <div key={tool.name} className="grid grid-cols-3 gap-1 text-xs py-1.5 border-b border-slate-800/50">
                  <span className="text-slate-300 font-medium truncate">{tool.name}</span>
                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-[50px] bg-slate-700 rounded-full h-1">
                      <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${tool.pctUsers}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${intensityDot[tool.intensity]}`} />
                    <span className="text-slate-400 text-[10px]">{tool.intensity}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Total time/wk shown as intensity</p>
          </div>
        </div>

        {/* ── Right panel: React Flow diagram ────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 260px)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <span className="text-sm font-semibold text-slate-200">Workflow: Sales Pipeline</span>
                <span className="ml-2 text-xs text-slate-500">Process Flow (drag to reorder · connect nodes)</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Legend */}
                <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Success</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Fail</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> Retry</span>
                </div>
                <button
                  onClick={addTask}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus size={12} /> Add Task
                </button>
              </div>
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={1.5}
            >
              <Controls />
              <MiniMap
                nodeColor={() => '#1E2D4A'}
                maskColor="rgba(8,12,24,0.7)"
              />
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1E2D4A" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </StepLayout>
  )
}

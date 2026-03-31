import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { Users, Clock, Plus, Layers, AlertCircle } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import { SkeletonCard, PageLoader } from '../components/ui/Skeleton'
import { nodeTypes } from '../components/workflow/CustomNodes'
// import { roleStats, toolBuckets, existingNodes, existingEdges } from '../data/mockData'
import { roleStats, toolBuckets } from '../data/mockData'

 import { useMarkovData } from '../hooks/pullMarkovData'

const bucketColorMap: Record<string, string> = {
  indigo:  'bg-[#F4E8FB] text-[#5E149F] border-[#5E149F]/20',
  violet:  'bg-[#FCEAF4] text-[#B4308B] border-[#B4308B]/20',
  cyan:    'bg-[#F2EEFF] text-[#5E149F] border-[#5E149F]/16',
  emerald: 'bg-[#EEF8F4] text-[#248F63] border-[#248F63]/18',
  amber:   'bg-[#FFF5DF] text-[#C98400] border-[#C98400]/18',
  rose:    'bg-[#FFE9EF] text-[#E2409B] border-[#E2409B]/20',
}

const intensityDot: Record<string, string> = {
  High:   'bg-[#248F63]',
  Medium: 'bg-[#C98400]',
  Low:    'bg-[#F75A8C]',
}

export default function WorkflowReport() {
  const { projectId } = useParams<{ projectId: string }>()
  const { existingNodes, existingEdges, loading, error } = useMarkovData(projectId)

  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState(existingNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(existingEdges)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  if (loading && projectId) {
    return (
      <StepLayout
        currentStep={2}
        title="Existing Workflow Report"
        subtitle="Loading workflow data..."
        hideNextButton
      >
        <div className="flex gap-6 h-full">
          <div className="w-72 flex-shrink-0 space-y-5">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={6} />
          </div>
          <div className="flex-1">
            <PageLoader message="Loading workflow graph..." />
          </div>
        </div>
      </StepLayout>
    )
  }

  if (error && projectId) {
    return (
      <StepLayout
        currentStep={2}
        title="Existing Workflow Report"
        subtitle="Failed to load workflow data"
        onNext={() => navigate(projectId ? `/projects/${projectId}/tool-input` : '/internal/tool-input')}
        nextLabel="Analyze New Tool"
      >
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle size={40} className="text-[#F75A8C]" />
          <p className="text-[#F75A8C] text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[#5E149F] hover:text-[#B4308B] underline"
          >
            Try again
          </button>
        </div>
      </StepLayout>
    )
  }

  const onConnect = useCallback(
        (params: Connection) =>
          setEdges((eds) =>
            addEdge(
              {
                ...params,
                type: 'smoothstep',
                style: { stroke: '#5E149F', strokeWidth: 2 },
                label: '?%',
                labelStyle: { fill: '#5E149F', fontWeight: 700, fontSize: 11 },
                labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.95 },
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
      onNext={() => navigate(projectId ? `/projects/${projectId}/tool-input` : '/internal/tool-input')}
      nextLabel="Analyze New Tool"
    >
      <div className="flex gap-6 h-full">

        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-5 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">

          {/* Role Stats */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'rgba(94,20,159,0.10)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-4">Role Stats</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-black/46">Type of team</span>
                <span className="text-xs font-semibold text-[#5E149F] bg-[#F4E8FB] px-2 py-0.5 rounded-full">{roleStats.teamType}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-xs text-black/46">Role</span>
                <span className="text-xs font-medium text-black/78 text-right max-w-[160px] leading-snug">{roleStats.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-black/46 flex items-center gap-1"><Users size={11} /> Employees</span>
                <span className="text-sm font-bold text-black">{roleStats.numEmployees}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-black/46 flex items-center gap-1"><Layers size={11} /> Avg tools used</span>
                <span className="text-sm font-bold text-black">{roleStats.avgToolsUsed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-black/46 flex items-center gap-1"><Clock size={11} /> Avg weekly hrs</span>
                <span className="text-sm font-bold text-black">{roleStats.avgWeeklyHours}h</span>
              </div>
            </div>
          </div>

          {/* Tool Stack */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'rgba(94,20,159,0.10)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-4">Tool Stack</h3>
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
                            ? 'bg-[#F4E8FB] text-[#5E149F]'
                            : 'text-black/70 hover:bg-black/[0.03]'
                        }`}
                      >
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-black/34">{tool.pctUsers}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular tools table */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'rgba(94,20,159,0.10)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-3">Popular Tools</h3>
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-1 text-[10px] text-black/34 font-semibold uppercase tracking-wide pb-1 border-b border-black/8">
                <span>Tool</span>
                <span className="text-center">% using</span>
                <span className="text-right">Intensity</span>
              </div>
              {topTools.map((tool) => (
                <div key={tool.name} className="grid grid-cols-3 gap-1 text-xs py-1.5 border-b border-black/6">
                  <span className="text-black/78 font-medium truncate">{tool.name}</span>
                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-[50px] bg-black/8 rounded-full h-1">
                      <div className="h-1 rounded-full" style={{ width: `${tool.pctUsers}%`, background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${intensityDot[tool.intensity]}`} />
                    <span className="text-black/42 text-[10px]">{tool.intensity}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-black/34 mt-2">Total time/wk shown as intensity</p>
          </div>
        </div>

        {/* ── Right panel: React Flow diagram ────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div
            className="bg-white border rounded-[24px] overflow-hidden"
            style={{
              height: 'calc(100vh - 260px)',
              borderColor: 'rgba(94,20,159,0.10)',
              boxShadow: '0 18px 40px rgba(15,23,42,0.05)',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FCF7FF 100%)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
              <div>
                <span className="text-sm font-semibold text-black">Workflow: Sales Pipeline</span>
                <span className="ml-2 text-xs text-black/42">Process Flow (drag to reorder · connect nodes)</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Legend */}
                <div className="hidden lg:flex items-center gap-3 text-xs text-black/42">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#248F63] inline-block rounded" /> Success</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#F75A8C] inline-block rounded" /> Fail</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#C98400] inline-block rounded" /> Retry</span>
                </div>
                <button
                  onClick={addTask}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#5E149F] bg-[#F4E8FB] hover:bg-[#EEDFF8] border border-[#5E149F]/16 px-3 py-1.5 rounded-full transition-colors"
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
                nodeColor={() => '#EEDFF8'}
                maskColor="rgba(255,255,255,0.75)"
              />
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#E8D8F4" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </StepLayout>
  )
}

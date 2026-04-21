import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import gsap from 'gsap'
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
import { Users, AlertCircle, Plus } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import { SkeletonCard, PageLoader } from '../components/ui/Skeleton'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { projects as projectsApi, tasks as tasksApi, type Project, type TaskNode } from '../api/client'
import { useMarkovData } from '../hooks/pullMarkovData'
import { useGsapReveal } from '../hooks/useGsapReveal'
import { useTheme } from '../hooks/useTheme'


export default function WorkflowReport() {
  const { projectId } = useParams<{ projectId: string }>()
  const { existingNodes, existingEdges, loading, error } = useMarkovData(projectId)
  const { theme } = useTheme()

  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState(existingNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(existingEdges)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Project + task data from API
  const [project, setProject] = useState<Project | null>(null)
  const [taskNodes, setTaskNodes] = useState<TaskNode[]>([])

  useGsapReveal(rootRef, [projectId, existingNodes.length, existingEdges.length, loading, error], {
    selectors: ['[data-gsap-reveal-panel]'],
    duration: 0.62,
    stagger: 0.1,
    y: 20,
    blur: 12,
  })

  useEffect(() => {
    if (!projectId) return
    projectsApi.get(projectId).then(setProject).catch(() => {})
    tasksApi.get(projectId).then(setTaskNodes).catch(() => {})
  }, [projectId])

  // Derive tool list from task app_cluster
  const derivedToolList = useMemo(() => {
    if (taskNodes.length === 0) return []
    const map: Record<string, { minutes: number; count: number }> = {}
    for (const task of taskNodes) {
      for (const tool of task.app_cluster) {
        if (!map[tool]) map[tool] = { minutes: 0, count: 0 }
        map[tool].minutes += task.duration_distribution.mean_minutes
        map[tool].count++
      }
    }
    return Object.entries(map)
      .map(([name, { minutes, count }]) => ({ name, weeklyHrs: +(minutes / 60 / 5).toFixed(1), count }))
      .sort((a, b) => b.weeklyHrs - a.weeklyHrs)
  }, [taskNodes])

  if (loading && projectId) {
    return (
      <StepLayout
        currentStep={2}
        title="Existing Workflow Report"
        subtitle="Loading workflow data..."
        hideNextButton
      >
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-72 lg:flex-shrink-0 space-y-5">
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
          <AlertCircle size={40} className="text-axispurple-300" />
          <p className="text-axispurple-300 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-axispurple-900 hover:text-axispurple-700 underline"
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
                style: { stroke: 'var(--axis-violet-900)', strokeWidth: 2 },
                label: '?%',
                labelStyle: { fill: 'var(--axis-violet-900)', fontWeight: 700, fontSize: 11 },
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

  useEffect(() => {
    const scope = rootRef.current
    if (!scope || loading || (!projectId && !existingNodes.length)) return

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
      stagger: 0.03,
      ease: 'power3.out',
      clearProps: 'transform',
    }).fromTo(edgeEls, {
      autoAlpha: 0,
    }, {
      autoAlpha: 1,
      duration: 0.3,
      stagger: 0.01,
      ease: 'power1.out',
    }, '-=0.2')

    return () => {
      tl.kill()
    }
  }, [existingNodes.length, existingEdges.length, loading, projectId])

  return (
    <StepLayout
      currentStep={2}
      title="Existing Workflow Report"
      subtitle="Your team's current workflow, tool stack, and process flow — based on telemetry and role data."
      onNext={() => navigate(projectId ? `/projects/${projectId}/tool-input` : '/internal/tool-input')}
      nextLabel="Analyze New Tool"
    >
      <div ref={rootRef} className="flex flex-col lg:flex-row gap-6">

        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div data-gsap-reveal-panel className="w-full lg:w-72 lg:flex-shrink-0 space-y-5 lg:overflow-y-auto lg:max-h-[calc(100vh-260px)] pr-1">

          {/* Role Stats */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'var(--border-accent)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-4">Role Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs text-black/46">Role</span>
                <span className="text-xs font-medium text-black/78 text-right max-w-[160px] leading-snug">
                  {project?.primary_role ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-black/46 flex items-center gap-1"><Users size={11} /> Employees</span>
                <span className="text-sm font-bold text-black">{project?.team_size ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Tool Stack */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'var(--border-accent)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-4">Tool Stack</h3>
            {derivedToolList.length > 0 ? (
              <div className="space-y-1.5">
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
              <p className="text-xs text-black/38">Run the pipeline to populate your tool stack.</p>
            )}
          </div>
        </div>

        {/* ── Right panel: React Flow diagram ────────────────────────────────── */}
        <div data-gsap-reveal-panel className="flex-1 min-w-0">
          <div
            className="bg-white border rounded-[24px] overflow-hidden"
            style={{
              height: 'clamp(400px, 60vw, calc(100vh - 260px))',
              borderColor: 'var(--border-accent)',
              boxShadow: '0 18px 40px rgba(15,23,42,0.05)',
              background: 'var(--surface-card)',
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
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-sea-500 inline-block rounded" /> Success</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-axispurple-300 inline-block rounded" /> Fail</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#C98400] inline-block rounded" /> Retry</span>
                </div>
                <button
                  onClick={addTask}
                  className="flex items-center gap-1.5 text-xs font-semibold text-axispurple-900 bg-[var(--surface-accent-subtle)] hover:bg-axispurple-900/10 border border-axispurple-900/16 px-3 py-1.5 rounded-full transition-colors"
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
                nodeColor={() => theme === 'dark' ? '#4A2575' : '#EEDFF8'}
                maskColor={theme === 'dark' ? 'rgba(13,17,23,0.7)' : 'rgba(255,255,255,0.75)'}
              />
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#1E2A40' : '#E8D8F4'} />
            </ReactFlow>
          </div>
        </div>
      </div>
    </StepLayout>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { TrendingDown, TrendingUp, Minus, DollarSign, Zap, Info, ChevronLeft, GitBranch } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import CosmoChatWidget from '../components/workspace/CosmoChatWidget'
import { CLIENT_SIMULATIONS_SEED } from '../data/clientSimulations'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { toolTimeMetrics, simulationNodes, simulationEdges } from '../data/mockData'
import {
  toolEvals,
  simulation as simulationApi,
  recommendation as recApi,
  projects as projectsApi,
  tasks as tasksApi,
  type Project,
  type RecommendationData,
  type SimulationData,
  type TaskNode,
} from '../api/client'
import { useJobProgress } from '../hooks/useJobProgress'
import { useMarkovData } from '../hooks/pullMarkovData'

function formatDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const LOADING_STEPS = [
  { label: 'Parsing tool documentation…',    pct: 15 },
  { label: 'Scraping product website…',       pct: 30 },
  { label: 'Mapping features to workflow…',   pct: 50 },
  { label: 'Running Monte Carlo simulation…', pct: 70 },
  { label: 'Computing impact estimates…',     pct: 88 },
  { label: 'Generating workflow diff…',        pct: 100 },
]


export default function SimulationResults() {
  const { projectId, toolEvalId } = useParams<{ projectId: string; toolEvalId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const evalParam = searchParams.get('eval')
  const isProjectScoped = !!(projectId && toolEvalId)
  const isFlatClient = !isProjectScoped

  // Job progress for project-scoped mode (jobId passed via navigation state)
  const passedJobId = (location.state as { jobId?: string } | null)?.jobId ?? null
  const [jobId, setJobId] = useState<string | null>(passedJobId)
  const jobProgress = useJobProgress(isProjectScoped ? jobId : null)

  // Legacy loading animation state
  const [loadStep, setLoadStep] = useState(0)
  const [legacyDone, setLegacyDone] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)

  // Tool name — from API or localStorage
  const [toolName, setToolName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('axisToolInput') ?? '{}').toolName || ''
    } catch {
      return ''
    }
  })

  // Project-scoped API data
  const [project, setProject] = useState<Project | null>(null)
  const [recData, setRecData] = useState<RecommendationData | null>(null)
  const [simData, setSimData] = useState<SimulationData | null>(null)
  const [taskNodes, setTaskNodes] = useState<TaskNode[]>([])
  const [apiLoading, setApiLoading] = useState(isProjectScoped)

  // Workflow graph — use real Markov data for project-scoped, mock for flat
  const { existingNodes: wfNodes, existingEdges: wfEdges } = useMarkovData(
    isProjectScoped ? projectId : undefined,
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(isProjectScoped ? [] : simulationNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(isProjectScoped ? [] : simulationEdges)

  useEffect(() => {
    if (!isProjectScoped || wfNodes.length === 0) return
    setNodes(wfNodes.map((n) => ({ ...n })))
    setEdges(wfEdges.map((e) => ({ ...e })))
  }, [isProjectScoped, wfNodes, wfEdges])

  // Fetch all project data when project-scoped
  useEffect(() => {
    if (!isProjectScoped) {
      if (evalParam) {
        const sim = CLIENT_SIMULATIONS_SEED.find((s) => s.id === evalParam)
        if (sim) setToolName(sim.toolName)
      }
      return
    }
    setApiLoading(true)
    Promise.all([
      toolEvals.get(projectId!, toolEvalId!).then((te) => setToolName(te.tool_name)).catch(() => {}),
      projectsApi.get(projectId!).then(setProject).catch(() => {}),
      recApi.get(projectId!, toolEvalId!).then(setRecData).catch(() => {}),
      simulationApi.get(projectId!, toolEvalId!).then(setSimData).catch(() => {}),
      tasksApi.get(projectId!).then(setTaskNodes).catch(() => {}),
    ]).finally(() => setApiLoading(false))
  }, [projectId, toolEvalId, isProjectScoped, evalParam])

  // Derive time metrics from task nodes + simulation node savings
  const derivedTimeMetrics = useMemo(() => {
    if (!isProjectScoped || taskNodes.length === 0) return null
    const results = simData?.results_json as Record<string, unknown> | undefined
    const summary = results?.summary as Record<string, unknown> | undefined
    const savings = (summary?.node_savings_min ?? {}) as Record<string, number>
    return taskNodes
      .filter((t) => savings[t.node_id] != null)
      .map((t) => ({
        tool: t.label,
        before: `${Math.round(t.duration_distribution.mean_minutes)}m/day`,
        after: `${Math.max(0, Math.round(t.duration_distribution.mean_minutes - savings[t.node_id]))}m/day`,
        saved: Math.round(savings[t.node_id]),
        change: 'decrease' as const,
        note: t.description,
      }))
      .sort((a, b) => b.saved - a.saved)
      .slice(0, 5)
  }, [isProjectScoped, taskNodes, simData])

  // Derive tool list from task app_cluster entries
  const derivedToolList = useMemo(() => {
    if (!isProjectScoped || taskNodes.length === 0) return null
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
  }, [isProjectScoped, taskNodes])

  // In project-scoped mode never fall back to mock data
  const timeMetrics = isProjectScoped ? (derivedTimeMetrics ?? []) : (derivedTimeMetrics ?? toolTimeMetrics)

  // Legacy loading sequence (only for flat route)
  useEffect(() => {
    if (isProjectScoped || legacyDone) return
    if (loadStep >= LOADING_STEPS.length - 1) {
      const t = setTimeout(() => setLegacyDone(true), 600)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setLoadStep((s) => s + 1), 700)
    return () => clearTimeout(t)
  }, [loadStep, legacyDone, isProjectScoped])

  // Determine if we're done with the job (separate from API data loading)
  const jobDone = isProjectScoped
    ? jobProgress.isDone || jobProgress.isFailed || !jobId
    : legacyDone
  // Only render results once the job is done AND API data has been fetched
  const done = jobDone && !apiLoading

  const totalSaved = timeMetrics
    .filter((m) => m.change === 'decrease')
    .reduce((acc, m) => acc + ((m as any).saved ?? 0), 0)
  const cosmoDemoContext = useMemo(
    () => ({
      tool_name: toolName,
      role: project?.primary_role ?? 'sales',
      team_size: project?.team_size ?? null,
      total_saved_minutes_per_day: totalSaved,
      tool_stack: (derivedToolList ?? []).slice(0, 10),
      time_metrics: timeMetrics.slice(0, 8),
    }),
    [toolName, project, totalSaved, derivedToolList, timeMetrics],
  )

  const recommendationPath = isProjectScoped
    ? `/projects/${projectId}/recommendation/${toolEvalId}`
    : evalParam
      ? `/recommendation?eval=${encodeURIComponent(evalParam)}`
      : '/recommendation'

  const flatShellHeader = (
    <div className="flex items-start gap-4">
      <button
        type="button"
        onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')}
        className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/70 transition-colors hover:bg-black/[0.03]"
        aria-label="Back to dashboard"
      >
        <ChevronLeft size={20} />
      </button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black md:text-3xl">Simulation results</h1>
        <p className="mt-1 text-sm text-black/55">
          Impact of <span className="font-semibold text-[#5E149F]">{toolName}</span> on your{' '}
          {project?.primary_role ?? 'sales'} workflow
          {done ? ` · ${totalSaved}min/day savings per rep` : ''}
        </p>
      </div>
    </div>
  )

  if (!done) {
    // Project-scoped: use real job progress
    const pct = isProjectScoped
      ? (jobProgress.job?.progress_pct ?? 0)
      : LOADING_STEPS[loadStep].pct
    const stepLabel = isProjectScoped
      ? (jobProgress.job?.current_step ?? 'Starting simulation...')
      : LOADING_STEPS[loadStep].label

    const loadingBody = (
      <div
        className={`flex flex-1 items-center justify-center px-6 py-12 ${
          isFlatClient ? '' : 'min-h-screen'
        }`}
        style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FCF7FF 100%)' }}
      >
        <div
          className="w-full max-w-2xl rounded-[32px] border bg-white px-10 py-12"
          style={{
            borderColor: 'rgba(94,20,159,0.10)',
            boxShadow: '0 28px 60px rgba(15,23,42,0.08)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FCF7FF 100%)',
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-8 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(180deg, #5E149F 0%, #F75A8C 100%)' }}
              >
                <Zap size={18} className="text-white" fill="white" />
              </div>
              <span className="text-[1.75rem] font-bold tracking-tight text-black">Axis</span>
            </div>

            <h2 className="mb-3 text-[2rem] font-bold leading-tight text-black">Running Simulation</h2>
            <p className="mb-10 max-w-xl text-base text-black/56">
              Analyzing how <span className="font-semibold text-[#5E149F]">{toolName}</span> would affect your{' '}
              {project?.primary_role ?? 'sales'} workflow.
            </p>
          </div>

          <div className="rounded-[24px] border border-black/6 bg-white/80 px-6 py-6">
            <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-black/8">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                aria-hidden="true"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)',
                }}
              />
            </div>
            <div className="mb-8 flex justify-between text-sm text-black/50">
              <span>{stepLabel}</span>
              <span className="font-semibold text-[#5E149F]">{pct}%</span>
            </div>

            <div className="space-y-3 text-left">
              {LOADING_STEPS.map((step, i) => {
                const stepDone = isProjectScoped ? pct >= step.pct : i < loadStep
                const stepActive = isProjectScoped
                  ? (pct >= (LOADING_STEPS[i - 1]?.pct ?? 0) && pct < step.pct)
                  : i === loadStep
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-[16px] px-3 py-3 text-sm transition-all ${
                      stepDone
                        ? 'bg-[#EEF8F4] text-[#248F63]'
                        : stepActive
                          ? 'bg-[#F4E8FB] text-[#5E149F]'
                          : 'bg-black/[0.02] text-black/34'
                    }`}
                  >
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      stepDone
                        ? 'bg-[#248F63] text-white'
                        : stepActive
                          ? 'animate-pulse-slow bg-[#5E149F] text-white'
                          : 'bg-black/8 text-black/32'
                    }`}>
                      {stepDone ? '✓' : stepActive ? '●' : '○'}
                    </div>
                    {step.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )

    if (isFlatClient) {
      return (
        <ClientWorkspaceShell headerLeft={flatShellHeader} projectId={projectId}>
          {loadingBody}
        </ClientWorkspaceShell>
      )
    }

    return loadingBody
  }

  // Project-scoped: no simulation data found after loading completed
  if (isProjectScoped && done && !simData) {
    const emptyBody = (
      <div className="flex flex-1 items-center justify-center bg-[#F7F4FB] px-6 py-24">
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(94,20,159,0.08)' }}>
            <GitBranch size={26} style={{ color: '#5E149F' }} />
          </div>
          <div>
            <p className="text-base font-semibold text-black">No simulation data yet</p>
            <p className="mt-1 text-sm text-black/50">
              This tool evaluation hasn't been simulated. Go back to the dashboard and run a simulation.
            </p>
          </div>
          <button
            onClick={() => navigate(`/projects/${projectId}/dashboard`)}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
    if (isFlatClient) {
      return (
        <ClientWorkspaceShell headerLeft={flatShellHeader} projectId={projectId}>
          {emptyBody}
        </ClientWorkspaceShell>
      )
    }
    return emptyBody
  }

  const resultsLayout = (
    <StepLayout
      currentStep={4}
      title="Simulation Results"
      subtitle={`Impact of adding ${toolName} to your ${project?.primary_role ?? 'sales'} workflow — ${totalSaved}min/day savings per rep`}
      embedded={isFlatClient}
      backPath={
        isFlatClient
          ? evalParam
            ? `/simulation?eval=${encodeURIComponent(evalParam)}`
            : '/simulation'
          : undefined
      }
      onNext={() => navigate(recommendationPath)}
      nextLabel="View Final Recommendation"
    >
      <div className="flex gap-6 h-full">

        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">

          {/* Role + tool stack */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'rgba(94,20,159,0.10)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-3">Role Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-black/46">Role</span><span className="text-black/78 text-right max-w-[150px] leading-snug">{project?.primary_role ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-black/46">Employees</span><span className="text-black font-bold">{project?.team_size ?? '—'}</span></div>
            </div>

            <div className="border-t border-black/8 mt-3 pt-3">
              <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-3">Tool Stack (Updated)</h3>
              <div className="space-y-1.5">
                {/* Existing tools from task data */}
                {derivedToolList ? (
                  derivedToolList.map((t) => (
                    <div key={t.name} className="text-xs text-black/56 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-black/22" />
                        {t.name}
                      </span>
                      <span className="text-black/38">{t.weeklyHrs}h/wk</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-black/38">Run pipeline to populate tool stack.</p>
                )}
                {/* New tool being evaluated */}
                {toolName && (
                  <div className="mt-2 pt-2 border-t border-black/6">
                    <div className="text-xs text-[#5E149F] flex items-center gap-1 font-semibold">
                      <Zap size={10} className="text-[#F75A8C]" />
                      {toolName} <span className="text-[10px] font-normal text-[#B4308B]">NEW</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estimated time per tool */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'rgba(94,20,159,0.10)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-3">Estimated Time Impact</h3>
            {timeMetrics.length === 0 && (
              <p className="text-xs text-black/38 py-2">Time impact data not available.</p>
            )}
            <div className="space-y-3">
              {timeMetrics.map((m) => (
                <div key={m.tool} className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-black/78 font-medium leading-snug">{m.tool}</span>
                    <button
                      onMouseEnter={() => setTooltip(m.tool)}
                      onMouseLeave={() => setTooltip(null)}
                      className="text-black/26 hover:text-black/52 flex-shrink-0"
                    >
                      <Info size={11} />
                    </button>
                  </div>

                  {tooltip === m.tool && (
                    <div className="absolute right-0 top-5 z-10 bg-white border border-black/8 rounded-lg px-3 py-2 text-xs text-black/62 max-w-[200px] shadow-xl">
                      {m.note}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    {m.change === 'new' ? (
                      <span className="text-xs text-[#B4308B] font-semibold bg-[#FCEAF4] px-2 py-0.5 rounded">NEW · {m.after}</span>
                    ) : (
                      <>
                        <span className="text-xs text-black/34 line-through">{m.before}</span>
                        <span className="text-black text-xs font-semibold">{m.after}</span>
                        {m.change === 'decrease' && (
                          <span className="flex items-center gap-0.5 text-[#248F63] text-xs font-bold">
                            <TrendingDown size={11} /> {(m as any).saved}m
                          </span>
                        )}
                        {m.change === 'increase' && (
                          <span className="flex items-center gap-0.5 text-[#C98400] text-xs font-bold">
                            <TrendingUp size={11} /> temp
                          </span>
                        )}
                        {m.change === 'same' && (
                          <Minus size={10} className="text-black/26" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-black/8">
              <div className="flex items-center justify-between">
                <span className="text-xs text-black/46 font-medium">Net time saved/day</span>
                <span className="text-[#248F63] font-bold text-sm">{totalSaved}min</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-black/46 font-medium">Per rep per week</span>
                <span className="text-[#248F63] font-bold text-sm">{(totalSaved * 5 / 60).toFixed(1)}h</span>
              </div>
            </div>
          </div>

          {/* Cost estimation */}
          <div
            className="bg-white border rounded-[24px] p-5"
            style={{ borderColor: 'rgba(94,20,159,0.10)', boxShadow: '0 18px 40px rgba(15,23,42,0.05)' }}
          >
            <h3 className="text-xs font-bold text-black/42 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <DollarSign size={11} /> Cost Estimation
            </h3>
            {recData ? (() => {
              const toolCost = recData.company_impact.tool_cost
              const revenueP70 = recData.company_impact.revenue_impact.p70
              const roi = toolCost > 0 ? (revenueP70 / toolCost).toFixed(1) + '×' : '—'
              return (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-black/46">Annual license ({toolName})</span>
                    <span className="text-black font-medium">{formatDollar(toolCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black/46">Est. revenue impact</span>
                    <span className="text-[#248F63] font-semibold">{formatDollar(revenueP70)}/yr</span>
                  </div>
                  <div className="flex justify-between border-t border-black/8 pt-2 mt-2">
                    <span className="text-black/78 font-semibold">Net ROI</span>
                    <span className="text-[#248F63] font-bold text-sm">{roi}</span>
                  </div>
                  <div className="mt-3 text-[10px] text-black/34">
                    Based on {project?.team_size ?? '—'} {project?.primary_role ?? 'reps'} · {totalSaved}min/day savings
                  </div>
                </div>
              )
            })() : (
              <p className="text-xs text-black/38">Cost data unavailable.</p>
            )}
          </div>
        </div>

        {/* ── Right panel: modified workflow ─────────────────────────────────── */}
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
                <span className="text-sm font-semibold text-black">Modified Workflow</span>
                <span className="ml-2 text-xs text-black/42">New paths highlighted in violet</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-black/42">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#248F63] inline-block rounded" /> Success</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#F75A8C] inline-block rounded" /> Fail</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#5E149F] inline-block rounded" /> New path</span>
              </div>
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.25}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
            >
              <Controls showInteractive={false} />
              <MiniMap nodeColor={(n) => n.data?.isNew ? '#B4308B' : '#EEDFF8'} maskColor="rgba(255,255,255,0.75)" />
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#E8D8F4" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </StepLayout>
  )

  if (isFlatClient) {
    return (
      <ClientWorkspaceShell headerLeft={flatShellHeader}>
        <div className="flex min-h-0 flex-1 flex-col">{resultsLayout}</div>
        <CosmoChatWidget page="simulation" demoContext={cosmoDemoContext} />
      </ClientWorkspaceShell>
    )
  }

  return (
    <>
      {resultsLayout}
      <CosmoChatWidget projectId={projectId} page="simulation" toolEvaluationId={toolEvalId} />
    </>
  )
}

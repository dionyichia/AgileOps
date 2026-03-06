import { useState, useEffect, useCallback } from 'react'
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
import { TrendingDown, TrendingUp, Minus, DollarSign, Zap, Info } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import { nodeTypes } from '../components/workflow/CustomNodes'
import { roleStats, toolBuckets, toolTimeMetrics, simulationNodes, simulationEdges } from '../data/mockData'

const LOADING_STEPS = [
  { label: 'Parsing tool documentation…',    pct: 15 },
  { label: 'Scraping product website…',       pct: 30 },
  { label: 'Mapping features to workflow…',   pct: 50 },
  { label: 'Running Monte Carlo simulation…', pct: 70 },
  { label: 'Computing impact estimates…',     pct: 88 },
  { label: 'Generating workflow diff…',        pct: 100 },
]

const bucketColorMap: Record<string, string> = {
  indigo:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  violet:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  cyan:    'bg-cyan-500/15  text-cyan-300  border-cyan-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose:    'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

export default function SimulationResults() {
  const navigate = useNavigate()
  const [loadStep, setLoadStep] = useState(0)
  const [done, setDone] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)

  const [nodes, , onNodesChange] = useNodesState(simulationNodes)
  const [edges, , onEdgesChange] = useEdgesState(simulationEdges)

  // Loading sequence
  useEffect(() => {
    if (done) return
    if (loadStep >= LOADING_STEPS.length - 1) {
      const t = setTimeout(() => setDone(true), 600)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setLoadStep((s) => s + 1), 700)
    return () => clearTimeout(t)
  }, [loadStep, done])

  const toolName = (() => {
    try {
      return JSON.parse(localStorage.getItem('axisToolInput') ?? '{}').toolName || 'Apollo.io'
    } catch {
      return 'Apollo.io'
    }
  })()

  const totalSaved = toolTimeMetrics
    .filter((m) => m.change === 'decrease')
    .reduce((acc, m) => acc + ((m as any).saved ?? 0), 0)

  if (!done) {
    const current = LOADING_STEPS[loadStep]
    const pct = current.pct
    return (
      <div className="min-h-screen bg-[#080C18] flex flex-col items-center justify-center gap-8 px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">axis</span>
        </div>

        <div className="w-full max-w-md text-center">
          <h2 className="text-xl font-bold text-white mb-2">Running Simulation</h2>
          <p className="text-slate-400 text-sm mb-8">Analyzing how <span className="text-indigo-400 font-medium">{toolName}</span> would affect your SDR workflow…</p>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mb-8">
            <span>{current.label}</span>
            <span>{pct}%</span>
          </div>

          {/* Steps list */}
          <div className="space-y-2 text-left">
            {LOADING_STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm transition-all ${
                i < loadStep ? 'text-emerald-400' : i === loadStep ? 'text-white' : 'text-slate-700'
              }`}>
                <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] ${
                  i < loadStep ? 'bg-emerald-500/20 text-emerald-400' : i === loadStep ? 'bg-indigo-500/20 text-indigo-400 animate-pulse-slow' : 'bg-slate-800'
                }`}>
                  {i < loadStep ? '✓' : i === loadStep ? '●' : '○'}
                </div>
                {step.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <StepLayout
      currentStep={4}
      title="Simulation Results"
      subtitle={`Impact of adding ${toolName} to your SDR workflow — ${totalSaved}min/day savings per rep`}
      onNext={() => navigate('/recommendation')}
      nextLabel="View Final Recommendation"
    >
      <div className="flex gap-6 h-full">

        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">

          {/* Role + tool stack */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Role Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Team</span><span className="text-white font-medium">{roleStats.teamType}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="text-slate-200 text-right max-w-[150px] leading-snug">SDR</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Employees</span><span className="text-white font-bold">{roleStats.numEmployees}</span></div>
            </div>

            <div className="border-t border-slate-800 mt-3 pt-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tool Stack (Updated)</h3>
              <div className="space-y-3">
                {toolBuckets.map((b) => (
                  <div key={b.category}>
                    <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${bucketColorMap[b.color]}`}>
                      {b.category}
                    </span>
                    <div className="mt-1.5 pl-1 space-y-1">
                      {b.tools.map((t) => (
                        <div key={t.name} className="text-xs text-slate-400 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-slate-600" />
                          {t.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* New tool */}
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border bg-blue-500/15 text-blue-300 border-blue-500/30">
                    NEW · Sales Engagement
                  </span>
                  <div className="mt-1.5 pl-1">
                    <div className="text-xs text-blue-300 flex items-center gap-1 font-semibold">
                      <Zap size={10} className="text-blue-400" />
                      {toolName}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Estimated time per tool */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Estimated Time Impact</h3>
            <div className="space-y-3">
              {toolTimeMetrics.map((m) => (
                <div key={m.tool} className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-300 font-medium leading-snug">{m.tool}</span>
                    <button
                      onMouseEnter={() => setTooltip(m.tool)}
                      onMouseLeave={() => setTooltip(null)}
                      className="text-slate-600 hover:text-slate-400 flex-shrink-0"
                    >
                      <Info size={11} />
                    </button>
                  </div>

                  {tooltip === m.tool && (
                    <div className="absolute right-0 top-5 z-10 bg-[#1A2235] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 max-w-[200px] shadow-xl">
                      {m.note}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    {m.change === 'new' ? (
                      <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded">NEW · {m.after}</span>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500 line-through">{m.before}</span>
                        <span className="text-white text-xs font-semibold">{m.after}</span>
                        {m.change === 'decrease' && (
                          <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-bold">
                            <TrendingDown size={11} /> {(m as any).saved}m
                          </span>
                        )}
                        {m.change === 'increase' && (
                          <span className="flex items-center gap-0.5 text-amber-400 text-xs font-bold">
                            <TrendingUp size={11} /> temp
                          </span>
                        )}
                        {m.change === 'same' && (
                          <Minus size={10} className="text-slate-600" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Net time saved/day</span>
                <span className="text-emerald-400 font-bold text-sm">{totalSaved}min</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-400 font-medium">Per rep per week</span>
                <span className="text-emerald-400 font-bold text-sm">{(totalSaved * 5 / 60).toFixed(1)}h</span>
              </div>
            </div>
          </div>

          {/* Cost estimation */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <DollarSign size={11} /> Cost Estimation
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Annual license ({toolName})</span>
                <span className="text-white font-medium">$8,400</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. value of time saved</span>
                <span className="text-emerald-400 font-semibold">$56,000/yr</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                <span className="text-slate-300 font-semibold">Net ROI</span>
                <span className="text-emerald-400 font-bold text-sm">6.7× </span>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-slate-600">
              Based on 24 SDRs @ $60k avg salary + {totalSaved}min/day savings
            </div>
          </div>
        </div>

        {/* ── Right panel: modified workflow ─────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 260px)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <span className="text-sm font-semibold text-slate-200">Modified Workflow</span>
                <span className="ml-2 text-xs text-slate-500">New paths highlighted in blue</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Success</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Fail</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> New path</span>
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
              <MiniMap nodeColor={(n) => n.data?.isNew ? '#3B82F6' : '#1E2D4A'} maskColor="rgba(8,12,24,0.7)" />
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1E2D4A" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </StepLayout>
  )
}

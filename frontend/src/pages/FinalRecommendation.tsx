import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TrendingUp, Users, Building2, CheckCircle2, Download, Star, ChevronLeft } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import CosmoChatWidget from '../components/workspace/CosmoChatWidget'
import { CLIENT_SIMULATIONS_SEED } from '../data/clientSimulations'
import { PageLoader } from '../components/ui/Skeleton'
import { recommendationData } from '../data/mockData'
import { recommendation as recApi, projects as projectsApi, RecommendationData as ApiRecData, type Project } from '../api/client'

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function lerpF(a: number, b: number, t: number) {
  return +(a + (b - a) * t).toFixed(1)
}

function formatDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default function FinalRecommendation() {
  const { projectId, toolEvalId } = useParams<{ projectId: string; toolEvalId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const evalParam = searchParams.get('eval')
  const isProjectScoped = !!(projectId && toolEvalId)
  const isFlatClient = !isProjectScoped

  const simFromEval = useMemo(
    () => (evalParam ? CLIENT_SIMULATIONS_SEED.find((s) => s.id === evalParam) : undefined),
    [evalParam],
  )
  const [adoption, setAdoption] = useState(40) // 10 – 70
  const [apiData, setApiData] = useState<ApiRecData | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(isProjectScoped)

  // Fetch from API when project-scoped
  useEffect(() => {
    if (!isProjectScoped) return
    setLoading(true)
    Promise.all([
      recApi.get(projectId!, toolEvalId!).then(setApiData).catch(() => {}),
      projectsApi.get(projectId!).then(setProject).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [projectId, toolEvalId, isProjectScoped])

  const t = (adoption - 10) / (70 - 10) // 0 → 1

  // Use API data when available, mock data as fallback
  const ei = apiData
    ? {
        timeSaved: apiData.employee_impact.time_saved,
        velocityGain: apiData.employee_impact.velocity_gain,
      }
    : { timeSaved: recommendationData.employeeImpact.timeSaved, velocityGain: recommendationData.employeeImpact.velocityGain }

  const ci = apiData
    ? {
        throughput: apiData.company_impact.throughput,
        revenueImpact: apiData.company_impact.revenue_impact,
        toolCost: apiData.company_impact.tool_cost,
      }
    : { throughput: recommendationData.companyImpact.throughput, revenueImpact: recommendationData.companyImpact.revenueImpact, toolCost: recommendationData.companyImpact.toolCost }

  const timeSaved   = lerpF(ei.timeSaved.p10,     ei.timeSaved.p70,     t)
  const velocity    = lerp (ei.velocityGain.p10,   ei.velocityGain.p70,  t)
  const throughput  = lerp (ci.throughput.p10,     ci.throughput.p70,    t)
  const revenue     = lerp (ci.revenueImpact.p10,  ci.revenueImpact.p70, t)
  const netRevenue  = revenue - ci.toolCost

  // Backend returns confidence_score as float [0.1–0.95]; convert to integer percentage
  const conf = apiData
    ? Math.round(apiData.confidence_score * 100)
    : recommendationData.confidenceScore
  const summary = apiData?.summary ?? recommendationData.summary
  const useCases = apiData?.use_cases ?? recommendationData.useCases

  const toolName =
    apiData?.tool_name ??
    simFromEval?.toolName ??
    (() => {
      try {
        return JSON.parse(localStorage.getItem('axisToolInput') ?? '{}').toolName || 'Apollo.io'
      } catch {
        return 'Apollo.io'
      }
    })()
  const cosmoDemoContext = useMemo(
    () => ({
      tool_name: toolName,
      role: project?.primary_role ?? 'sales',
      summary,
      confidence_score: conf,
      employee_impact: {
        time_saved: timeSaved,
        velocity,
      },
      company_impact: {
        throughput,
        revenue,
        net_revenue: netRevenue,
      },
      use_cases: useCases.slice(0, 6),
    }),
    [toolName, project, summary, conf, timeSaved, velocity, throughput, revenue, netRevenue, useCases],
  )

  const dashboardBackPath =
    evalParam != null && evalParam !== ''
      ? `/dashboard?tab=${encodeURIComponent(evalParam)}`
      : '/dashboard'

  const flatShellHeader = (
    <div className="flex items-start gap-4">
      <button
        type="button"
        onClick={() => navigate(dashboardBackPath)}
        className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/70 transition-colors hover:bg-black/[0.03]"
        aria-label="Back to dashboard"
      >
        <ChevronLeft size={20} />
      </button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black md:text-3xl">Final recommendation</h1>
        <p className="mt-1 text-sm text-black/55">
          Axis recommendation for <span className="font-semibold text-[#5E149F]">{toolName}</span> · based on your{' '}
          {project?.primary_role ?? 'sales'} workflow simulation
        </p>
      </div>
    </div>
  )

  if (loading) {
    if (isFlatClient) {
      return (
        <ClientWorkspaceShell headerLeft={flatShellHeader} projectId={projectId}>
          <div className="flex flex-1 items-center justify-center bg-[#F7F4FB] py-24">
            <PageLoader message="Loading recommendation..." />
          </div>
        </ClientWorkspaceShell>
      )
    }
    return <PageLoader message="Loading recommendation..." />
  }

  const layout = (
    <StepLayout
      currentStep={5}
      title="Final Recommendation"
      subtitle={`Axis recommendation for ${toolName} · based on your ${project?.primary_role ?? 'sales'} workflow simulation`}
      embedded={isFlatClient}
      backPath={isFlatClient ? dashboardBackPath : undefined}
      onNext={() =>
        navigate(isProjectScoped ? `/projects/${projectId}/dashboard` : dashboardBackPath)
      }
      nextLabel="Back to Dashboard"
      nextDisabled={false}
      hideNextButton={false}
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-4">

        {/* Recommendation card */}
        <div
          className="bg-white border rounded-[28px] p-6"
          style={{
            borderColor: 'rgba(94,20,159,0.10)',
            boxShadow: '0 22px 48px rgba(15,23,42,0.06)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FCF8FF 100%)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase mb-1 text-[#5E149F]">Recommendation</div>
              <h2 className="text-xl font-bold text-black">
                Adopt <span className="text-[#B4308B]">{toolName}</span> for your {project?.primary_role ?? 'sales'} team
              </h2>
            </div>
            <ConfidenceBadge score={conf} />
          </div>

          <div className="text-black/68 text-sm leading-relaxed whitespace-pre-line">
            {summary}
          </div>
        </div>

        {/* Adoption slider + impact */}
        <div
          className="bg-white border rounded-[28px] p-6"
          style={{
            borderColor: 'rgba(94,20,159,0.10)',
            boxShadow: '0 22px 48px rgba(15,23,42,0.06)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8FC 100%)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-black">Impact Analysis</h3>
            <span className="text-xs text-black/42">Simulations estimate 10% – 70% ↑ in throughput</span>
          </div>

          {/* Slider */}
          <div className="mt-4 mb-6">
            <div className="flex justify-between text-xs text-black/48 mb-2">
              <span>Estimated Adoption Rate</span>
              <span className="font-bold text-[#5E149F]">{adoption}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={70}
              step={5}
              value={adoption}
              onChange={(e) => setAdoption(Number(e.target.value))}
              className="w-full"
              style={{
                background: `linear-gradient(to right, #5E149F 0%, #F75A8C ${((adoption - 10) / 60) * 100}%, rgba(17,17,17,0.10) ${((adoption - 10) / 60) * 100}%, rgba(17,17,17,0.10) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-black/34 mt-1">
              <span>10% (cautious)</span>
              <span>40% (moderate)</span>
              <span>70% (full)</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Employee level */}
            <div
              className="border rounded-[24px] p-5"
              style={{
                borderColor: 'rgba(94,20,159,0.08)',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF6FF 100%)',
                boxShadow: '0 14px 30px rgba(15,23,42,0.04)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Users size={15} className="text-[#5E149F]" />
                <span className="text-xs font-bold text-black/46 uppercase tracking-widest">Employee Level</span>
              </div>
              <div className="space-y-4">
                <Metric
                  label={`Time saved per ${project?.primary_role ?? 'rep'}`}
                  value={`${timeSaved}h/week`}
                  sub={`${(timeSaved * 52).toFixed(0)}h/year · ~${(timeSaved * 52 * 60 / 8 / 250).toFixed(1)} workdays/yr`}
                  color="emerald"
                />
                <Metric
                  label="Prospects processed"
                  value={`+${velocity}%`}
                  sub="More prospects reached per week per rep"
                  color="indigo"
                />
                <Metric
                  label="Learning rate"
                  value={apiData?.employee_impact?.learning_weeks ?? "2–4 weeks"}
                  sub="Time to full feature adoption (peer benchmark)"
                  color="amber"
                />
              </div>
            </div>

            {/* Company level */}
            <div
              className="border rounded-[24px] p-5"
              style={{
                borderColor: 'rgba(94,20,159,0.08)',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7FB 100%)',
                boxShadow: '0 14px 30px rgba(15,23,42,0.04)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-[#B4308B]" />
                <span className="text-xs font-bold text-black/46 uppercase tracking-widest">Company Level</span>
              </div>
              <div className="space-y-4">
                <Metric
                  label="Qualified leads throughput"
                  value={`+${throughput}%`}
                  sub="More qualified leads entering pipeline per quarter"
                  color="violet"
                />
                <Metric
                  label="Est. revenue impact"
                  value={formatDollar(revenue)}
                  sub={`Net of tool cost: ${formatDollar(netRevenue)}/yr`}
                  color="emerald"
                />
                <Metric
                  label="Tool cost (annual)"
                  value={formatDollar(ci.toolCost)}
                  sub={project
                    ? `Est. license for ${project.team_size ?? '?'} ${project.primary_role ?? 'reps'}s`
                    : 'Est. annual license cost'}
                  color="slate"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Use cases */}
        <div
          className="bg-white border rounded-[28px] p-6"
          style={{
            borderColor: 'rgba(94,20,159,0.10)',
            boxShadow: '0 22px 48px rgba(15,23,42,0.06)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FCF8FF 100%)',
          }}
        >
          <h3 className="text-sm font-bold text-black mb-4">Use Cases</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="flex gap-3 border rounded-[22px] p-4"
                style={{
                  borderColor: 'rgba(94,20,159,0.08)',
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF6FF 100%)',
                  boxShadow: '0 12px 26px rgba(15,23,42,0.04)',
                }}
              >
                <CheckCircle2 size={16} className="text-[#5E149F] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-black mb-1">{uc.title}</div>
                  <div className="text-xs text-black/56 leading-relaxed">{uc.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary + actions */}
        <div
          className="bg-white border rounded-[28px] p-6"
          style={{
            borderColor: 'rgba(94,20,159,0.10)',
            boxShadow: '0 22px 48px rgba(15,23,42,0.06)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8FC 100%)',
          }}
        >
          <h3 className="text-sm font-bold text-black mb-3">Summary & Integration Plan</h3>
          <div className="text-sm text-black/60 leading-relaxed mb-5">
            At <strong className="text-[#5E149F]">{adoption}% adoption</strong>, integrating {toolName} into your{' '}
            {project?.primary_role ?? 'sales'} workflow is projected to save{' '}
            <strong className="text-[#B4308B]">{timeSaved} hours/rep/week</strong> and increase qualified
            pipeline by <strong className="text-[#F75A8C]">{throughput}%</strong> — generating an estimated{' '}
            <strong className="text-[#5E149F]">{formatDollar(netRevenue)}</strong> in net annual value against a{' '}
            {formatDollar(ci.toolCost)} license cost.
            <br /><br />
            Recommended rollout: Start with a pilot cohort for 4 weeks, measure reply rate and prospects-per-rep,
            then expand to the full team with a structured onboarding session.
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {}}
              className="flex items-center gap-2 text-white font-semibold px-5 py-3 rounded-full text-sm transition-colors"
              style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
            >
              <Download size={15} />
              Download Report
            </button>
            <button
              onClick={() =>
                navigate(isProjectScoped ? `/projects/${projectId}/dashboard` : dashboardBackPath)
              }
              className="flex items-center gap-2 border border-black/10 hover:border-black/18 text-black/62 hover:text-black font-medium px-5 py-3 rounded-full text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

      </div>
    </StepLayout>
  )

  if (isFlatClient) {
    return (
      <ClientWorkspaceShell headerLeft={flatShellHeader}>
        <div className="flex min-h-0 flex-1 flex-col">{layout}</div>
        <CosmoChatWidget page="recommendation" demoContext={cosmoDemoContext} />
      </ClientWorkspaceShell>
    )
  }

  return (
    <>
      {layout}
      <CosmoChatWidget projectId={projectId} page="recommendation" toolEvaluationId={toolEvalId} />
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-[#5E149F]',
    indigo:  'text-[#B4308B]',
    violet:  'text-[#F75A8C]',
    amber:   'text-[#B4308B]',
    slate:   'text-black/72',
  }
  return (
    <div>
      <div className="text-xs text-black/42 mb-0.5">{label}</div>
      <div className={`text-[1.75rem] leading-none font-bold ${colorMap[color] ?? 'text-black'}`}>{value}</div>
      <div className="text-xs text-black/42 leading-snug">{sub}</div>
    </div>
  )
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-[#5E149F] bg-[#F4E8FB] border-[#5E149F]/20'
              : score >= 60 ? 'text-[#B4308B] bg-[#FCEAF4] border-[#B4308B]/20'
              :               'text-[#F75A8C] bg-[#FFE9EF] border-[#F75A8C]/20'
  return (
    <div className={`flex flex-col items-center border rounded-[20px] px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ${color}`}>
      <div className="flex items-center gap-1 mb-1">
        <Star size={12} fill="currentColor" />
        <span className="text-xs font-semibold">Confidence</span>
      </div>
      <span className="text-2xl font-bold">{score}%</span>
      <div className="w-full bg-black/8 rounded-full h-1 mt-1">
        <div className="rounded-full h-1 transition-all" style={{ width: `${score}%`, background: 'currentColor' }} />
      </div>
    </div>
  )
}

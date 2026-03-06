import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Users, Building2, CheckCircle2, Download, Star } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import { recommendationData } from '../data/mockData'

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
  const navigate = useNavigate()
  const [adoption, setAdoption] = useState(40) // 10 – 70

  const t = (adoption - 10) / (70 - 10) // 0 → 1

  const ei = recommendationData.employeeImpact
  const ci = recommendationData.companyImpact

  const timeSaved   = lerpF(ei.timeSaved.p10,    ei.timeSaved.p70,    t)
  const velocity    = lerp (ei.velocityGain.p10,  ei.velocityGain.p70, t)
  const throughput  = lerp (ci.throughput.p10,    ci.throughput.p70,   t)
  const revenue     = lerp (ci.revenueImpact.p10, ci.revenueImpact.p70, t)
  const netRevenue  = revenue - ci.toolCost

  const conf = recommendationData.confidenceScore

  const toolName = (() => {
    try {
      return JSON.parse(localStorage.getItem('axisToolInput') ?? '{}').toolName || 'Apollo.io'
    } catch {
      return 'Apollo.io'
    }
  })()

  return (
    <StepLayout
      currentStep={5}
      title="Final Recommendation"
      subtitle={`Axis recommendation for ${toolName} · based on your SDR workflow simulation`}
      onNext={() => navigate('/')}
      nextLabel="Back to Dashboard"
      nextDisabled={false}
      hideNextButton={false}
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-4">

        {/* Recommendation card */}
        <div className="bg-gradient-to-br from-indigo-950/60 to-[#111827] border border-indigo-700/40 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-bold text-indigo-400 tracking-widest uppercase mb-1">Recommendation</div>
              <h2 className="text-xl font-bold text-white">
                Adopt <span className="text-indigo-300">{toolName}</span> for your SDR team
              </h2>
            </div>
            <ConfidenceBadge score={conf} />
          </div>

          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
            {recommendationData.summary}
          </div>
        </div>

        {/* Adoption slider + impact */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-200">Impact Analysis</h3>
            <span className="text-xs text-slate-500">Simulations estimate 10% – 70% ↑ in throughput</span>
          </div>

          {/* Slider */}
          <div className="mt-4 mb-6">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Estimated Adoption Rate</span>
              <span className="font-bold text-indigo-300">{adoption}%</span>
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
                background: `linear-gradient(to right, #6366F1 0%, #6366F1 ${((adoption - 10) / 60) * 100}%, #1E2D4A ${((adoption - 10) / 60) * 100}%, #1E2D4A 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>10% (cautious)</span>
              <span>40% (moderate)</span>
              <span>70% (full)</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Employee level */}
            <div className="bg-[#0F1629] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={15} className="text-indigo-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Employee Level</span>
              </div>
              <div className="space-y-4">
                <Metric
                  label="Time saved per SDR"
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
                  value="3–4 weeks"
                  sub="Time to full feature adoption (peer benchmark)"
                  color="amber"
                />
              </div>
            </div>

            {/* Company level */}
            <div className="bg-[#0F1629] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-violet-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Company Level</span>
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
                  sub="Est. license for 24 SDRs"
                  color="slate"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Use cases */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-200 mb-4">Use Cases</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {recommendationData.useCases.map((uc) => (
              <div key={uc.title} className="flex gap-3 bg-[#0F1629] border border-slate-800 rounded-xl p-4">
                <CheckCircle2 size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-200 mb-1">{uc.title}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{uc.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary + actions */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-200 mb-3">Summary & Integration Plan</h3>
          <div className="text-sm text-slate-400 leading-relaxed mb-5">
            At <strong className="text-indigo-300">{adoption}% adoption</strong>, integrating {toolName} into your SDR workflow
            is projected to save <strong className="text-emerald-400">{timeSaved} hours/rep/week</strong> and increase qualified
            pipeline by <strong className="text-violet-400">{throughput}%</strong> — generating an estimated{' '}
            <strong className="text-emerald-400">{formatDollar(netRevenue)}</strong> in net annual value against a{' '}
            {formatDollar(ci.toolCost)} license cost.
            <br /><br />
            Recommended rollout: Start with a 5-rep pilot cohort for 4 weeks, measure reply rate and prospects-per-rep,
            then expand to the full team with a structured onboarding session.
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {}}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Download size={15} />
              Download Report
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

      </div>
    </StepLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    indigo:  'text-indigo-400',
    violet:  'text-violet-400',
    amber:   'text-amber-400',
    slate:   'text-slate-300',
  }
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${colorMap[color] ?? 'text-white'}`}>{value}</div>
      <div className="text-xs text-slate-500 leading-snug">{sub}</div>
    </div>
  )
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
              : score >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              :               'text-red-400 bg-red-500/10 border-red-500/30'
  return (
    <div className={`flex flex-col items-center border rounded-xl px-4 py-2 ${color}`}>
      <div className="flex items-center gap-1 mb-1">
        <Star size={12} fill="currentColor" />
        <span className="text-xs font-semibold">Confidence</span>
      </div>
      <span className="text-2xl font-bold">{score}%</span>
      <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
        <div className="rounded-full h-1 transition-all" style={{ width: `${score}%`, background: 'currentColor' }} />
      </div>
    </div>
  )
}

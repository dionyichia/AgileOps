import { useNavigate } from 'react-router-dom'
import { Zap, BarChart3, Users, DollarSign, TrendingUp, ArrowRight, Layers } from 'lucide-react'

const statCards = [
  { label: 'Workflows Analyzed',    value: '—',   sub: 'Add your first workflow', icon: Layers,      color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  { label: 'Tools in Portfolio',    value: '—',   sub: 'Connect your stack',      icon: BarChart3,   color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { label: 'Employees Covered',     value: '—',   sub: 'Invite your team',        icon: Users,       color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  { label: 'Estimated Monthly Waste', value: '—', sub: 'Discover your savings',   icon: DollarSign,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#080C18]">
      {/* Nav */}
      <header className="border-b border-slate-800 bg-[#0B0F1E]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap size={14} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">axis</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <span className="text-indigo-400 font-medium">Dashboard</span>
            <span className="hover:text-slate-200 cursor-pointer transition-colors">Reports</span>
            <span className="hover:text-slate-200 cursor-pointer transition-colors">Team</span>
            <span className="hover:text-slate-200 cursor-pointer transition-colors">Settings</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-semibold">
              AC
            </div>
            <span className="text-sm text-slate-400 hidden md:block">Acme Corp</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full mb-4">
            <TrendingUp size={12} />
            SaaS Intelligence Platform
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome to <span className="text-indigo-400">Axis</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Identify wasted SaaS spend, optimize your team's workflows, and surface the right tools at the right time.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="bg-[#111827] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
              <div className="text-xs text-slate-500 font-medium">{label}</div>
              <div className="text-xs text-slate-600 mt-1">{sub}</div>
            </div>
          ))}
        </div>

        {/* Main CTA */}
        <div className="bg-gradient-to-br from-[#111827] to-[#0F1A30] border border-indigo-900/50 rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse-slow" />
              <span className="text-xs text-indigo-400 font-semibold tracking-wide uppercase">Get started</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Map your team's workflow
            </h2>
            <p className="text-slate-400 leading-relaxed text-sm">
              Tell us about your team's role, responsibilities, and the tools they use daily. Axis will analyze your workflow,
              identify gaps, and simulate how a new tool would change your process — before you commit to anything.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
              {['Workflow analysis', 'Tool matching', 'ROI simulation', 'Personalized recommendation'].map((tag) => (
                <span key={tag} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-indigo-500" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/form')}
            className="flex-shrink-0 flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          >
            Populate your Existing Workflow Info
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Recent activity placeholder */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Recent Analyses</h3>
            <div className="text-center py-8 text-slate-600 text-sm">
              <Layers size={32} className="mx-auto mb-3 text-slate-700" />
              No workflow analyses yet.<br />Start by populating your first workflow.
            </div>
          </div>
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Tool Recommendations</h3>
            <div className="text-center py-8 text-slate-600 text-sm">
              <BarChart3 size={32} className="mx-auto mb-3 text-slate-700" />
              No recommendations yet.<br />Complete a workflow analysis to get started.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

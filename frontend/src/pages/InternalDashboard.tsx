import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  ChevronRight,
  FileText,
  GitBranch,
  Wrench,
  FlaskConical,
  FileBarChart,
  MessageSquareDashed,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Mail,
  Phone,
  Calendar,
  ArrowRight,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Transcript {
  name: string
  role: string
  date: string
  tasksExtracted: number
}

interface ActivityItem {
  action: string
  detail: string
  time: string
}

interface PipelineStage {
  name: string
  status: 'completed' | 'in_progress' | 'pending'
}

interface Project {
  id: string
  company: string
  contactName: string
  contactEmail: string
  contactPhone: string
  teamType: string
  role: string
  teamSize: number
  status: 'intake' | 'transcripts' | 'workflow' | 'simulation' | 'delivered'
  createdAt: string
  tools: string[]
  transcripts: Transcript[]
  pipeline: PipelineStage[]
  taskCount: number
  avgCycleTime: string
  activity: ActivityItem[]
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-acme',
    company: 'Acme Corp',
    contactName: 'Sarah Chen',
    contactEmail: 'sarah.chen@acme.com',
    contactPhone: '+1 (415) 555-0134',
    teamType: 'Sales',
    role: 'SDR',
    teamSize: 24,
    status: 'simulation',
    createdAt: '2026-03-10',
    tools: ['Salesforce', 'HubSpot', 'Outreach', 'Apollo.io', 'LinkedIn Sales Nav', 'ZoomInfo', 'Gmail', 'Slack', 'Zoom', 'Gong.io', 'Calendly', 'Notion', 'Google Docs'],
    transcripts: [
      { name: 'Jake Martinez', role: 'Senior SDR', date: '2026-03-12', tasksExtracted: 8 },
      { name: 'Priya Patel', role: 'SDR Team Lead', date: '2026-03-13', tasksExtracted: 11 },
      { name: 'Marcus Johnson', role: 'SDR', date: '2026-03-14', tasksExtracted: 6 },
      { name: 'Emily Wong', role: 'Sales Manager', date: '2026-03-15', tasksExtracted: 9 },
    ],
    pipeline: [
      { name: 'Transcripts parsed', status: 'completed' },
      { name: 'Task graph built', status: 'completed' },
      { name: 'Telemetry generated', status: 'completed' },
      { name: 'Markov matrix built', status: 'completed' },
      { name: 'Simulation running', status: 'in_progress' },
      { name: 'Recommendation', status: 'pending' },
    ],
    taskCount: 7,
    avgCycleTime: '179 min',
    activity: [
      { action: 'Simulation started', detail: 'Salesforce full adoption — 2,000 Monte Carlo runs', time: '2 hours ago' },
      { action: 'Pipeline completed', detail: 'Markov matrix built: 7 states, 13 transitions', time: '3 hours ago' },
      { action: 'Transcript processed', detail: 'Emily Wong — 9 tasks extracted, 3 merged', time: '1 day ago' },
      { action: 'Transcript processed', detail: 'Marcus Johnson — 6 tasks extracted, 2 new', time: '2 days ago' },
      { action: 'Project created', detail: 'After discovery call with Sarah Chen', time: 'Mar 10' },
    ],
  },
  {
    id: 'proj-globex',
    company: 'Globex Industries',
    contactName: 'David Kim',
    contactEmail: 'd.kim@globex.io',
    contactPhone: '+1 (650) 555-0289',
    teamType: 'Sales',
    role: 'Account Executive',
    teamSize: 12,
    status: 'transcripts',
    createdAt: '2026-03-18',
    tools: ['Salesforce', 'Outreach', 'LinkedIn Sales Nav', 'Gong.io', 'Zoom', 'Gmail', 'Slack', 'DocuSign'],
    transcripts: [
      { name: 'Rachel Torres', role: 'Senior AE', date: '2026-03-20', tasksExtracted: 12 },
    ],
    pipeline: [
      { name: 'Transcripts parsed', status: 'in_progress' },
      { name: 'Task graph built', status: 'pending' },
      { name: 'Telemetry generated', status: 'pending' },
      { name: 'Markov matrix built', status: 'pending' },
      { name: 'Simulation', status: 'pending' },
      { name: 'Recommendation', status: 'pending' },
    ],
    taskCount: 12,
    avgCycleTime: '~340 min (est.)',
    activity: [
      { action: 'Transcript processed', detail: 'Rachel Torres — 12 tasks extracted', time: '1 day ago' },
      { action: 'Interview scheduled', detail: 'Tom Chen (AE) — Mar 25, 2pm PST', time: '2 days ago' },
      { action: 'Interview scheduled', detail: 'Lisa Park (AE Lead) — Mar 26, 10am PST', time: '2 days ago' },
      { action: 'Discovery call', detail: 'David Kim — qualified, signed engagement', time: 'Mar 18' },
      { action: 'Project created', detail: 'Inbound from intake form', time: 'Mar 18' },
    ],
  },
  {
    id: 'proj-initech',
    company: 'Initech',
    contactName: 'Michael Brooks',
    contactEmail: 'm.brooks@initech.com',
    contactPhone: '+1 (512) 555-0177',
    teamType: 'Customer Success',
    role: 'CSM',
    teamSize: 8,
    status: 'intake',
    createdAt: '2026-03-22',
    tools: ['HubSpot', 'Intercom', 'Slack', 'Notion', 'Zoom', 'Gmail', 'Jira'],
    transcripts: [],
    pipeline: [
      { name: 'Transcripts parsed', status: 'pending' },
      { name: 'Task graph built', status: 'pending' },
      { name: 'Telemetry generated', status: 'pending' },
      { name: 'Markov matrix built', status: 'pending' },
      { name: 'Simulation', status: 'pending' },
      { name: 'Recommendation', status: 'pending' },
    ],
    taskCount: 0,
    avgCycleTime: 'TBD',
    activity: [
      { action: 'Discovery call scheduled', detail: 'Mar 25, 11am CST with Michael Brooks', time: '2 days ago' },
      { action: 'Intake form submitted', detail: '8 CSMs, 7 tools — biggest pain: manual QBR prep', time: '3 days ago' },
      { action: 'Project created', detail: 'Auto-created from intake form', time: 'Mar 22' },
    ],
  },
  {
    id: 'proj-umbrella',
    company: 'Umbrella Corp',
    contactName: 'Jessica Huang',
    contactEmail: 'j.huang@umbrella.co',
    contactPhone: '+1 (212) 555-0341',
    teamType: 'Sales',
    role: 'SDR',
    teamSize: 32,
    status: 'delivered',
    createdAt: '2026-02-15',
    tools: ['Salesforce', 'SalesLoft', 'LinkedIn Sales Nav', 'ZoomInfo', 'Gong.io', 'Zoom', 'Gmail', 'Slack', 'Notion', 'Calendly'],
    transcripts: [
      { name: 'Alex Rivera', role: 'SDR', date: '2026-02-18', tasksExtracted: 7 },
      { name: 'Sam Nguyen', role: 'SDR Team Lead', date: '2026-02-19', tasksExtracted: 10 },
      { name: 'Jordan Blake', role: 'Senior SDR', date: '2026-02-20', tasksExtracted: 8 },
      { name: 'Taylor Washington', role: 'SDR', date: '2026-02-21', tasksExtracted: 5 },
      { name: 'Casey Lin', role: 'Sales Manager', date: '2026-02-22', tasksExtracted: 11 },
    ],
    pipeline: [
      { name: 'Transcripts parsed', status: 'completed' },
      { name: 'Task graph built', status: 'completed' },
      { name: 'Telemetry generated', status: 'completed' },
      { name: 'Markov matrix built', status: 'completed' },
      { name: 'Simulation complete', status: 'completed' },
      { name: 'Recommendation delivered', status: 'completed' },
    ],
    taskCount: 9,
    avgCycleTime: '205 min',
    activity: [
      { action: 'Report delivered', detail: 'ROI readout sent to Jessica Huang — Salesforce + SalesLoft focus', time: '1 week ago' },
      { action: 'Simulation completed', detail: 'SalesLoft full adoption: 3.8 hrs/wk saved per SDR', time: '1 week ago' },
      { action: 'Simulation completed', detail: 'Salesforce full adoption: 2.9 hrs/wk saved per SDR', time: '1 week ago' },
      { action: 'Pipeline completed', detail: 'All 5 transcripts processed, 9-node workflow built', time: '2 weeks ago' },
      { action: 'Project created', detail: 'Referral from Acme Corp (Sarah Chen)', time: 'Feb 15' },
    ],
  },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  intake:       { label: 'Intake',        color: 'bg-slate-500/15 text-slate-400',       icon: Clock },
  transcripts:  { label: 'Transcripts',   color: 'bg-gold-500/15 text-gold-300',         icon: MessageSquareDashed },
  workflow:     { label: 'Workflow',       color: 'bg-cerulean-500/15 text-cerulean-300', icon: GitBranch },
  simulation:   { label: 'Simulation',    color: 'bg-magenta-500/15 text-magenta-300',   icon: FlaskConical },
  delivered:    { label: 'Delivered',      color: 'bg-sea-500/15 text-sea-300',           icon: CheckCircle2 },
}

const STAGE_ICON: Record<string, string> = {
  completed:   'bg-sea text-white',
  in_progress: 'bg-gold text-black',
  pending:     'bg-slate-700 text-slate-500',
}

const PROJECT_STEPS = [
  { key: 'transcripts', label: 'Transcripts',     icon: MessageSquareDashed, path: 'transcripts',          description: 'Interview transcripts → task extraction' },
  { key: 'form',        label: 'Workflow Info',    icon: FileText,            path: 'form',                 description: 'Role, responsibilities, tools' },
  { key: 'workflow',    label: 'Workflow Report',  icon: GitBranch,           path: 'workflow-report',      description: 'Markov graph visualization' },
  { key: 'tool-input',  label: 'Tool Input',       icon: Wrench,              path: 'tool-input',           description: 'Tool evaluation setup' },
  { key: 'simulation',  label: 'Simulation',       icon: FlaskConical,        path: 'simulation/demo',      description: 'Monte Carlo results' },
  { key: 'recommendation', label: 'Recommendation', icon: FileBarChart,       path: 'recommendation/demo', description: 'ROI readout' },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function InternalDashboard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  const filtered = MOCK_PROJECTS.filter((p) =>
    p.company.toLowerCase().includes(search.toLowerCase()) ||
    p.teamType.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase()) ||
    p.contactName.toLowerCase().includes(search.toLowerCase()),
  )

  const handleStepClick = (projectId: string, path: string) => {
    const internalPaths: Record<string, string> = {
      'form': '/internal/form',
      'workflow-report': '/internal/workflow-report',
      'tool-input': '/internal/tool-input',
    }
    navigate(internalPaths[path] ?? `/projects/${projectId}/${path}`)
  }

  const totalTranscripts = MOCK_PROJECTS.reduce((sum, p) => sum + p.transcripts.length, 0)

  return (
    <div className="min-h-screen bg-[#F7F4FB] flex flex-col text-black">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-black/8 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/axis-logo.png"
                alt="Axis logo"
                className="h-11 w-11 rounded-2xl object-cover"
              />
              <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
            </div>
            <span className="text-xs font-medium text-[#5E149F] bg-[#F4E8FB] px-2.5 py-1 rounded-full">INTERNAL</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/34" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects, contacts..."
                className="bg-[#F7F4FB] border border-black/10 focus:border-[#B4308B] focus:outline-none text-black placeholder:text-black/30 rounded-2xl pl-9 pr-4 py-2.5 text-sm w-72 transition-colors"
              />
            </div>
            <button className="flex items-center gap-2 text-white px-4 py-2.5 rounded-full font-semibold text-sm transition-colors" style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}>
              <Plus size={14} />
              New Project
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8">

        {/* Overview stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Total Projects</div>
            <div className="text-2xl font-bold text-black">{MOCK_PROJECTS.length}</div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Active</div>
            <div className="text-2xl font-bold text-[#B4308B]">{MOCK_PROJECTS.filter((p) => p.status !== 'delivered').length}</div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Transcripts</div>
            <div className="text-2xl font-bold text-black">{totalTranscripts}</div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Delivered</div>
            <div className="text-2xl font-bold text-[#5E149F]">{MOCK_PROJECTS.filter((p) => p.status === 'delivered').length}</div>
          </div>
          <div className="bg-white border border-black/8 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-xs text-black/42 mb-1">Total Reps</div>
            <div className="text-2xl font-bold text-black">{MOCK_PROJECTS.reduce((sum, p) => sum + p.teamSize, 0)}</div>
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Projects</h2>
            <span className="text-xs text-slate-600">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.map((project) => {
            const statusCfg = STATUS_CONFIG[project.status]
            const StatusIcon = statusCfg.icon
            const isExpanded = expandedProject === project.id
            const completedStages = project.pipeline.filter((s) => s.status === 'completed').length
            const pipelinePct = Math.round((completedStages / project.pipeline.length) * 100)

            return (
              <div key={project.id} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
                {/* Project row */}
                <button
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-cerulean/20 border border-cerulean-500/20 flex items-center justify-center text-cerulean-300 text-sm font-bold">
                      {project.company.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white">{project.company}</div>
                      <div className="text-xs text-slate-500">{project.contactName} · {project.teamType} · {project.role} · {project.teamSize} reps</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    {/* Pipeline progress mini */}
                    <div className="hidden md:flex items-center gap-2">
                      <div className="w-24 bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pipelinePct === 100 ? 'bg-sea' : 'bg-cerulean'}`}
                          style={{ width: `${pipelinePct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 w-8">{pipelinePct}%</span>
                    </div>

                    <div className="text-right hidden md:block">
                      <div className="text-xs text-slate-500">{project.transcripts.length} transcript{project.transcripts.length !== 1 ? 's' : ''}</div>
                      <div className="text-[10px] text-slate-600">{project.activity[0]?.time}</div>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${statusCfg.color}`}>
                      <StatusIcon size={12} />
                      {statusCfg.label}
                    </span>
                    <ChevronRight size={16} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* ── Expanded detail ─────────────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-[#0B0F1E] animate-fade-in">
                    <div className="grid grid-cols-3 gap-px bg-slate-800">

                      {/* ── Left column: Contact + Tools ─────────────────────── */}
                      <div className="bg-[#0B0F1E] p-5 space-y-5">
                        {/* Contact */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Contact</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Users size={12} className="text-slate-500" />
                              <span className="text-slate-200 font-medium">{project.contactName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Mail size={12} className="text-slate-500" />
                              <span className="text-slate-400">{project.contactEmail}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Phone size={12} className="text-slate-500" />
                              <span className="text-slate-400">{project.contactPhone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar size={12} className="text-slate-500" />
                              <span className="text-slate-400">Started {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Tool stack */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tool Stack ({project.tools.length})</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {project.tools.map((t) => (
                              <span key={t} className="text-[11px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-medium">{t}</span>
                            ))}
                          </div>
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
                            <div className="text-[10px] text-slate-600 mb-0.5">Task Nodes</div>
                            <div className="text-lg font-bold text-white">{project.taskCount}</div>
                          </div>
                          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
                            <div className="text-[10px] text-slate-600 mb-0.5">Cycle Time</div>
                            <div className="text-lg font-bold text-white">{project.avgCycleTime}</div>
                          </div>
                        </div>
                      </div>

                      {/* ── Center column: Pipeline + Transcripts ────────────── */}
                      <div className="bg-[#0B0F1E] p-5 space-y-5">
                        {/* Pipeline */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Pipeline</h4>
                          <div className="space-y-2">
                            {project.pipeline.map((stage, i) => (
                              <div key={i} className="flex items-center gap-2.5">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${STAGE_ICON[stage.status]}`}>
                                  {stage.status === 'completed' ? '✓' : stage.status === 'in_progress' ? '→' : i + 1}
                                </div>
                                <span className={`text-xs ${stage.status === 'completed' ? 'text-slate-300' : stage.status === 'in_progress' ? 'text-gold-300 font-medium' : 'text-slate-600'}`}>
                                  {stage.name}
                                </span>
                                {stage.status === 'in_progress' && (
                                  <Loader2 size={10} className="text-gold animate-spin" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Transcripts */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Transcripts ({project.transcripts.length})
                          </h4>
                          {project.transcripts.length === 0 ? (
                            <p className="text-xs text-slate-600">No transcripts yet — schedule interviews</p>
                          ) : (
                            <div className="space-y-1.5">
                              {project.transcripts.map((t, i) => (
                                <div key={i} className="flex items-center justify-between bg-[#111827] border border-slate-800 rounded-lg px-3 py-2">
                                  <div>
                                    <div className="text-xs font-medium text-slate-200">{t.name}</div>
                                    <div className="text-[10px] text-slate-600">{t.role} · {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                  </div>
                                  <span className="text-[10px] font-medium text-sea-300 bg-sea-500/10 px-1.5 py-0.5 rounded">
                                    {t.tasksExtracted} tasks
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Right column: Activity + Actions ─────────────────── */}
                      <div className="bg-[#0B0F1E] p-5 space-y-5">
                        {/* Activity */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Recent Activity</h4>
                          <div className="space-y-3">
                            {project.activity.map((item, i) => (
                              <div key={i} className="relative pl-4 border-l border-slate-800">
                                <div className="absolute left-0 top-1 w-1.5 h-1.5 rounded-full bg-slate-600 -translate-x-[3.5px]" />
                                <div className="text-xs font-medium text-slate-300">{item.action}</div>
                                <div className="text-[11px] text-slate-500 leading-snug">{item.detail}</div>
                                <div className="text-[10px] text-slate-600 mt-0.5">{item.time}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Bottom bar: navigation + actions ────────────────────── */}
                    <div className="border-t border-slate-800 px-5 py-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Jump to</div>
                      <div className="grid grid-cols-6 gap-2 mb-4">
                        {PROJECT_STEPS.map((step) => {
                          const StepIcon = step.icon
                          return (
                            <button
                              key={step.key}
                              onClick={() => handleStepClick(project.id, step.path)}
                              className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/30 transition-all group"
                            >
                              <StepIcon size={16} className="text-slate-500 group-hover:text-cerulean-300 transition-colors" />
                              <span className="text-[10px] font-medium text-slate-400 group-hover:text-white transition-colors">{step.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="flex items-center gap-2 text-xs font-medium text-cerulean hover:text-cerulean-300 transition-colors"
                        >
                          <ArrowRight size={12} />
                          View Client Dashboard
                        </button>
                        <span className="text-slate-800">|</span>
                        <button className="flex items-center gap-2 text-xs font-medium text-gold hover:text-gold-300 transition-colors">
                          <Loader2 size={12} />
                          Run Full Pipeline
                        </button>
                        <span className="text-slate-800">|</span>
                        <button className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors">
                          <AlertCircle size={12} />
                          Reset Tasks
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

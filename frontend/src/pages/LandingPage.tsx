import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap,
  ArrowRight,
  ArrowDown,
  MessageSquare,
  Search,
  Map,
  CheckCircle2,
  Send,
  Shield,
  Clock,
  Users,
  ChevronDown,
  X,
  BarChart3,
  TrendingUp,
  Target,
  Workflow,
} from 'lucide-react'

const GOLD = '#FFBF00'
const MAGENTA = '#E83F6F'
const CERULEAN = '#2274A5'
const SEA = '#32936F'

const CRMS = ['Salesforce', 'HubSpot', 'Pipedrive', 'Zoho CRM', 'Close', 'Freshsales', 'Microsoft Dynamics', 'Other']
const TEAM_SIZES = ['1–5', '6–15', '16–30', '31–50', '50+']

const emptyForm = () => ({
  name: '',
  email: '',
  company: '',
  teamSize: '',
  crm: '',
  tools: '',
  frustration: '',
})

export default function LandingPage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [scrolled, setScrolled] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  // Track scroll to style navbar + hide floating pill after hero
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
      if (heroRef.current) {
        setPastHero(window.scrollY > heroRef.current.offsetHeight * 0.3)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.company.trim() &&
    form.teamSize &&
    form.frustration.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitted(true)
  }

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const openModal = () => {
    setSubmitted(false)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid #e5e7eb' : '1px solid transparent',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: CERULEAN }}>
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span
              className="font-bold text-xl tracking-tight transition-colors duration-300"
              style={{ color: scrolled ? '#111' : '#111' }}
            >
              axis
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {[
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Why Axis', href: '#why-axis' },
              { label: 'Get started', href: '#intake' },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="transition-colors duration-300 hover:opacity-70"
                style={{ color: scrolled ? '#555' : '#444' }}
              >
                {label}
              </a>
            ))}
          </nav>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm px-4 py-2 rounded-lg transition-all duration-300 border"
            style={{
              color: scrolled ? '#555' : '#444',
              borderColor: scrolled ? '#d1d5db' : 'rgba(0,0,0,0.15)',
            }}
          >
            Client Login
          </button>
        </div>
      </header>

      {/* ── Hero (gold background) ─────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{ background: GOLD }}
      >
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border"
            style={{ color: '#333', borderColor: 'rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.35)' }}
          >
            <TrendingUp size={12} />
            Workflow Intelligence for Revenue Teams
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] mb-6 tracking-tight text-gray-900">
            Know which tools
            <br />
            <span style={{ color: CERULEAN }}>actually move the needle</span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10 text-gray-700">
            Axis maps your team's real workflow, simulates tool impact with Monte Carlo modeling,
            and delivers a data-backed recommendation — before you spend a dollar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={openModal}
              className="flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg active:scale-[0.98]"
              style={{ background: CERULEAN, boxShadow: `0 8px 30px rgba(34,116,165,0.3)` }}
            >
              Get your free workflow map
              <ArrowRight size={18} />
            </button>
          </div>

          <p className="text-xs text-gray-600 mt-5">
            No credit card. 15-min discovery call. Free workflow map after.
          </p>
        </div>

        {/* Curved bottom transition to white */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: 'linear-gradient(to bottom, transparent, white)',
          }}
        />
      </section>

      {/* ── Floating "See how it works" pill ────────────────────────────────── */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-500"
        style={{
          opacity: pastHero ? 0 : 1,
          transform: `translateX(-50%) translateY(${pastHero ? '20px' : '0px'})`,
          pointerEvents: pastHero ? 'none' : 'auto',
        }}
      >
        <a
          href="#how-it-works"
          className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl animate-bounce-slow"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            color: '#333',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <ArrowDown size={14} style={{ color: CERULEAN }} />
          See how it works
        </a>
      </div>

      {/* ── Everything below is white background ───────────────────────────── */}
      <div className="bg-white text-gray-900">

        {/* ── Trust bar ──────────────────────────────────────────────────────── */}
        <section className="border-b border-gray-100 py-8 px-6">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <Shield size={14} style={{ color: SEA }} /> Your data stays private
            </span>
            <span className="flex items-center gap-2">
              <Clock size={14} style={{ color: GOLD }} /> Results in 48 hours
            </span>
            <span className="flex items-center gap-2">
              <Users size={14} style={{ color: CERULEAN }} /> Built for revenue teams
            </span>
            <span className="flex items-center gap-2">
              <BarChart3 size={14} style={{ color: MAGENTA }} /> Monte Carlo simulation
            </span>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">How it works</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Three steps to a data-backed tool recommendation. No guesswork, no vendor bias.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: MessageSquare,
                  step: '01',
                  title: 'Quick intake + discovery call',
                  desc: 'Fill out a 2-minute form. We schedule a short call to understand your team, stack, and pain points.',
                  accent: GOLD,
                },
                {
                  icon: Map,
                  step: '02',
                  title: 'We map your workflow',
                  desc: "After the call, you get a free auto-generated workflow map showing how your team actually works — gaps, redundancies, and all.",
                  accent: CERULEAN,
                },
                {
                  icon: Search,
                  step: '03',
                  title: 'Simulate & recommend',
                  desc: 'We run Monte Carlo simulations against your real workflow to show exactly which tools move the needle and by how much.',
                  accent: SEA,
                },
              ].map(({ icon: Icon, step, title, desc, accent }) => (
                <div
                  key={step}
                  className="bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-md transition-all"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${accent}18` }}
                  >
                    <Icon size={20} style={{ color: accent }} />
                  </div>
                  <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-2">
                    Step {step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Axis ───────────────────────────────────────────────────────── */}
        <section id="why-axis" className="py-20 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Why Axis</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Stop relying on vendor demos and gut feelings. Get simulation-backed answers.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div
                className="bg-white border border-gray-100 rounded-2xl p-7"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${MAGENTA}15` }}
                  >
                    <Target size={18} style={{ color: MAGENTA }} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">For Sales & RevOps Leaders</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    'See where reps actually spend their time',
                    'Quantify ROI before buying a new tool',
                    'Reduce stack bloat and redundant licenses',
                    'Data-backed case for leadership buy-in',
                  ].map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-gray-500">
                      <CheckCircle2 size={15} style={{ color: MAGENTA }} className="flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="bg-white border border-gray-100 rounded-2xl p-7"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${SEA}15` }}
                  >
                    <Workflow size={18} style={{ color: SEA }} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">What you get</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    'Free workflow map after your discovery call',
                    'Tool-fit simulation with confidence scores',
                    'Employee-level and company-level impact projections',
                    'Stakeholder-ready ROI readout',
                  ].map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-gray-500">
                      <CheckCircle2 size={15} style={{ color: SEA }} className="flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA banner ─────────────────────────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-gray-100">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Ready to see your workflow?</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              It takes 2 minutes. We'll reach out within 24 hours to schedule your discovery call.
            </p>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg active:scale-[0.98]"
              style={{ background: CERULEAN, boxShadow: `0 8px 30px rgba(34,116,165,0.2)` }}
            >
              Get your free workflow map
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* ── Inline intake form ──────────────────────────────────────────────── */}
        <section id="intake" className="py-20 px-6 border-t border-gray-100 bg-gray-50">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3 text-gray-900">Get started</h2>
              <p className="text-gray-500">
                Tell us about your team. We'll reach out within 24 hours to schedule a quick discovery call.
              </p>
            </div>

            <IntakeForm
              form={form}
              set={set}
              canSubmit={!!canSubmit}
              submitted={submitted}
              onSubmit={handleSubmit}
            />
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-100 py-10 px-6 bg-white">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: CERULEAN }}>
                <Zap size={11} className="text-white" fill="white" />
              </div>
              <span className="font-bold text-gray-900 text-sm">axis</span>
              <span className="text-gray-400 text-xs ml-2">Workflow intelligence for revenue teams</span>
            </div>
            <div className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Axis. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <IntakeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        form={form}
        set={set}
        canSubmit={!!canSubmit}
        submitted={submitted}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

// ── Intake form (shared between inline + modal) ───────────────────────────────

function IntakeForm({
  form,
  set,
  canSubmit,
  submitted,
  onSubmit,
}: {
  form: ReturnType<typeof emptyForm>
  set: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  canSubmit: boolean
  submitted: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  if (submitted) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: `${SEA}15` }}
        >
          <CheckCircle2 size={28} style={{ color: SEA }} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Thanks, {form.name.split(' ')[0]}!
        </h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-1">
          We'll review your info and reach out within 24 hours to schedule a quick discovery call.
        </p>
        <p className="text-gray-400 text-xs">
          After the call, you'll get a free auto-generated workflow map for your team.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-[#2274A5] focus:ring-2 focus:ring-[#2274A5]/10 focus:outline-none text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm transition-all'

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5 shadow-sm"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Name <span style={{ color: MAGENTA }}>*</span>
          </label>
          <input type="text" value={form.name} onChange={set('name')} placeholder="Jane Smith" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Work email <span style={{ color: MAGENTA }}>*</span>
          </label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" className={inputClass} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Company <span style={{ color: MAGENTA }}>*</span>
          </label>
          <input type="text" value={form.company} onChange={set('company')} placeholder="Acme Corp" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Team size <span style={{ color: MAGENTA }}>*</span>
          </label>
          <div className="relative">
            <select value={form.teamSize} onChange={set('teamSize')} className={`${inputClass} pr-10 cursor-pointer appearance-none`}>
              <option value="">Select...</option>
              {TEAM_SIZES.map((s) => (<option key={s} value={s}>{s} people</option>))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Primary CRM <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <select value={form.crm} onChange={set('crm')} className={`${inputClass} pr-10 cursor-pointer appearance-none`}>
            <option value="">Select your CRM...</option>
            {CRMS.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Other tools in your stack <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
        <input type="text" value={form.tools} onChange={set('tools')} placeholder="e.g. Outreach, Gong, ZoomInfo, Slack..." className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Biggest workflow frustration <span style={{ color: MAGENTA }}>*</span>
        </label>
        <textarea
          value={form.frustration}
          onChange={set('frustration')}
          placeholder="In one or two sentences, what's the biggest friction point in your team's daily workflow?"
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: canSubmit ? CERULEAN : '#cbd5e1' }}
      >
        <Send size={15} />
        Submit — we'll be in touch
      </button>

      <p className="text-xs text-gray-400 text-center">
        No commitment. We'll schedule a 15-minute call to learn more about your team.
      </p>
    </form>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function IntakeModal({
  open,
  onClose,
  form,
  set,
  canSubmit,
  submitted,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  form: ReturnType<typeof emptyForm>
  set: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  canSubmit: boolean
  submitted: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl animate-slide-up">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Get your free workflow map</h3>
            <p className="text-xs text-gray-500 mt-0.5">Takes 2 minutes. We'll be in touch within 24 hours.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <IntakeForm form={form} set={set} canSubmit={canSubmit} submitted={submitted} onSubmit={onSubmit} />
        </div>
      </div>
    </div>
  )
}

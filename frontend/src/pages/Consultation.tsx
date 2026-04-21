import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { consultation as consultationApi } from '../api/client'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock3,
  BarChart3,
  Search,
  Target,
  ArrowLeft,
  Calendar,
} from 'lucide-react'
import PublicNavbar from '../components/public/PublicNavbar'
import PublicFooter from '../components/public/PublicFooter'

// ── Calendly global type ────────────────────────────────────────────────────
declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: {
        url: string
        parentElement: HTMLElement
        prefill?: Record<string, string>
        utm?: Record<string, string>
      }) => void
    }
  }
}

const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL as string

const ROLES = [
  'Sales Development Representative (SDR)',
  'Account Executive (AE)',
  'Customer Success Manager',
  'Sales Manager / Director',
  'Marketing Manager',
  'Product Manager',
  'Software Engineer',
  'Data Analyst',
]

const ROLE_RESPONSIBILITIES: Record<string, string[]> = {
  'Sales Development Representative (SDR)': [
    'Prospecting & lead generation',
    'Cold calling',
    'Cold emailing & outreach sequences',
    'Qualifying inbound leads',
    'LinkedIn outreach & social selling',
    'CRM data entry & hygiene',
  ],
  'Account Executive (AE)': [
    'Running discovery calls',
    'Product demonstrations',
    'Proposal & quote drafting',
    'Contract negotiation',
    'Stakeholder mapping',
    'Forecast management',
  ],
  'Customer Success Manager': [
    'Onboarding new customers',
    'QBR preparation & delivery',
    'Health score monitoring',
    'Renewal & expansion conversations',
    'Support ticket escalation',
    'Training & product adoption',
  ],
  'Sales Manager / Director': [
    'Pipeline reviews & coaching',
    'Quota planning & forecasting',
    'Hiring & onboarding reps',
    'Territory & comp design',
    'Cross-functional alignment',
    'Performance reporting',
  ],
  'Marketing Manager': [
    'Campaign planning & execution',
    'Lead routing & SLAs',
    'Content & collateral',
    'Event & webinar programs',
    'Marketing analytics',
    'Sales & marketing alignment',
  ],
  'Product Manager': [
    'Roadmap prioritization',
    'Customer discovery & feedback',
    'Release coordination',
    'Stakeholder communication',
    'Usage analytics',
    'Beta & launch programs',
  ],
  'Software Engineer': [
    'Feature development',
    'Code review & quality',
    'Integrations & APIs',
    'Incident response',
    'Technical documentation',
    'Cross-team support',
  ],
  'Data Analyst': [
    'Reporting & dashboards',
    'Pipeline & funnel analysis',
    'Data hygiene & modeling',
    'Ad hoc analysis',
    'Experiment analysis',
    'Tooling & automation',
  ],
}

const DEFAULT_RESPONSIBILITIES = [
  'Daily task planning',
  'Internal meetings & collaboration',
  'Documentation & reporting',
  'Email & communication management',
  'Cross-functional coordination',
]

function allResponsibilityOptions(): string[] {
  const set = new Set<string>()
  for (const arr of Object.values(ROLE_RESPONSIBILITIES)) {
    for (const item of arr) set.add(item)
  }
  for (const item of DEFAULT_RESPONSIBILITIES) set.add(item)
  return Array.from(set)
}

const ALL_RESPONSIBILITY_OPTIONS = allResponsibilityOptions()

const COLORS = {
  white: '#FFFFFF',
  violet: '#5E149F',
}

type Stage = 'form' | 'booking' | 'success'

// ── Calendly script loader (idempotent) ─────────────────────────────────────
function loadCalendlyAssets(): Promise<void> {
  return new Promise((resolve) => {
    // Inject CSS once
    if (!document.querySelector('link[data-calendly-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://assets.calendly.com/assets/external/widget.css'
      link.setAttribute('data-calendly-css', '1')
      document.head.appendChild(link)
    }

    // If script already loaded resolve immediately
    if (window.Calendly) { resolve(); return }

    // If script tag already injected, wait for it
    const existing = document.querySelector('script[data-calendly-js]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }

    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    script.setAttribute('data-calendly-js', '1')
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

export default function Consultation() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [formStep, setFormStep] = useState<1 | 2>(1)
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([])
  const [tools, setTools] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Stage: 'form' | 'booking' | 'success' ─────────────────────────────────
  const [stage, setStage] = useState<Stage>('form')
  const [booked, setBooked] = useState(false) // drives success animation timing
  const [calendlyReady, setCalendlyReady] = useState(false)
  const [calendlyError, setCalendlyError] = useState<string | null>(null)

  // ── Calendly container ref (must be empty — Calendly injects iframe here) ──
  const calendlyContainerRef = useRef<HTMLDivElement>(null)

  // ── Load + init Calendly when booking stage mounts ─────────────────────────
  useEffect(() => {
    if (stage !== 'booking') return
    setCalendlyReady(false)
    setCalendlyError(null)

    if (!CALENDLY_URL) {
      setCalendlyError(
        'Calendly is not configured yet. Add VITE_CALENDLY_URL to frontend/.env and restart the dev server.',
      )
      return
    }

    loadCalendlyAssets()
      .then(() => {
        if (!calendlyContainerRef.current || !window.Calendly) {
          setCalendlyError('Calendly failed to load. Please verify the booking URL and try again.')
          return
        }

        calendlyContainerRef.current.innerHTML = ''
        window.Calendly.initInlineWidget({
          url: `${CALENDLY_URL}?hide_gdpr_banner=1`,
          parentElement: calendlyContainerRef.current,
          prefill: {
            name: `${firstName} ${lastName}`.trim(),
            email,
          },
        })
        // Give Calendly's iframe a moment to paint before hiding the loader
        setTimeout(() => setCalendlyReady(true), 1800)
      })
      .catch(() => {
        setCalendlyError('Calendly failed to load. Please verify the booking URL and try again.')
      })
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for Calendly booking confirmation ───────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.origin !== 'https://calendly.com') return
      if ((e.data as { event?: string })?.event === 'calendly.event_scheduled') {
        setBooked(true)
        // Small delay so the widget doesn't flash away instantly
        setTimeout(() => setStage('success'), 400)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Form helpers ───────────────────────────────────────────────────────────
  const toggleResponsibility = (responsibility: string) => {
    setSelectedResponsibilities((prev) =>
      prev.includes(responsibility)
        ? prev.filter((item) => item !== responsibility)
        : [...prev, responsibility],
    )
  }

  const canGoToStep2 =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    Boolean(role) &&
    selectedResponsibilities.length > 0

  const canSubmit = description.trim().length > 0

  const handleNext = () => { if (canGoToStep2) setFormStep(2) }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await consultationApi.submit({
        first_name: firstName,
        last_name: lastName,
        email,
        company: company || undefined,
        role,
        selected_responsibilities: selectedResponsibilities,
        tools: tools || undefined,
        description: description || undefined,
      })
      setStage('booking')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('409')) {
        navigate('/login', { state: { notice: 'Looks like you already have an account. Sign in below.' } })
        return
      }
      console.error('Consultation submit failed:', err)
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-[18px] border border-white/10 bg-white/6 px-5 py-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#B4308B]'

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE: BOOKING — full-width Calendly widget
  // ══════════════════════════════════════════════════════════════════════════
  if (stage === 'booking') {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <PublicNavbar scrolled={scrolled} />

        {/* Body */}
        <main className="flex-1 px-6 pb-16 pt-28 md:px-10 md:pt-32">
          <div className="max-w-7xl mx-auto grid gap-10 lg:grid-cols-[1fr_1.5fr] items-start">

            {/* Left — copy */}
            <div className="pt-4 lg:sticky lg:top-32">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white"
                style={{ background: 'linear-gradient(90deg, #5E149F, #B4308B)' }}
              >
                <Calendar size={13} />
                Step 3 of 3
              </div>

              <h2 className="mt-5 text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-[-0.03em] text-white">
                Book your<br />consultation call.
              </h2>

              <p className="mt-5 text-[17px] leading-[1.65] text-white/64">
                Pick a time that works for you. On the call we'll walk through your workflow, confirm your current setup, and explain what comes next.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  '30-minute video call',
                  "We'll review your workflow submission beforehand",
                  "You'll get your recommendation report within 48h",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: 'linear-gradient(180deg, #B4308B 0%, #F75A8C 100%)' }}
                    >
                      <CheckCircle2 size={12} />
                    </span>
                    <span className="text-[15px] text-white/72">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setStage('form')}
                className="mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-white/68 transition-opacity hover:opacity-70"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>

            {/* Right — Calendly widget */}
            <div
              className="relative rounded-[24px] border border-white/8 overflow-hidden"
              style={{ minWidth: '320px', height: '700px', boxShadow: '0 18px 50px rgba(15,23,42,0.08), 0 4px 14px rgba(15,23,42,0.04)' }}
            >
              {/* Loading overlay — fades out once Calendly iframe paints */}
              {!calendlyReady && !calendlyError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--surface-card)' }}>
                  <div
                    className="h-7 w-7 animate-spin rounded-full border-2 border-white/10"
                    style={{ borderTopColor: '#B4308B' }}
                  />
                  <span className="text-[14px] text-white/40">Loading calendar…</span>
                </div>
              )}
              {calendlyError && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-8 text-center" style={{ background: 'var(--surface-card)' }}>
                  <div className="max-w-md">
                    <p className="text-[20px] font-semibold text-white">Calendar unavailable</p>
                    <p className="mt-3 text-[15px] leading-7 text-white/55">{calendlyError}</p>
                  </div>
                </div>
              )}
              {/* Empty container — Calendly appends its iframe here */}
              <div ref={calendlyContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>

          </div>
        </main>
        <PublicFooter />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE: SUCCESS — animated confirmation
  // ══════════════════════════════════════════════════════════════════════════
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <PublicNavbar scrolled={scrolled} />

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 pt-32 text-center">
          {/* Animated ring + checkmark */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 100, height: 100 }}
          >
            {/* Outer pulsing ring */}
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: 'linear-gradient(135deg, #5E149F, #F75A8C)' }}
            />
            {/* Inner gradient circle */}
            <span
              className="flex h-[100px] w-[100px] items-center justify-center rounded-full text-white"
              style={{
                background: 'linear-gradient(135deg, #5E149F 0%, #B4308B 50%, #F75A8C 100%)',
                boxShadow: '0 16px 40px rgba(94,20,159,0.30), 0 6px 16px rgba(247,90,140,0.20)',
              }}
            >
              {/* Checkmark SVG */}
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                className="success-check"
                style={{ strokeDasharray: 60, strokeDashoffset: booked ? 0 : 60, transition: 'stroke-dashoffset 0.55s ease 0.1s' }}
              >
                <polyline
                  points="8,22 18,32 36,14"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
          </div>

          {/* Text */}
          <h1
            className="mt-9 text-[38px] md:text-[50px] font-bold leading-[1.05] tracking-[-0.03em] text-white"
            style={{ animation: 'fadeSlideUp 0.5s ease 0.25s both' }}
          >
            You're all booked!
          </h1>

          <p
            className="mt-5 max-w-md text-[18px] leading-[1.65] text-white/60"
            style={{ animation: 'fadeSlideUp 0.5s ease 0.38s both' }}
          >
            A calendar invite is on its way to <strong className="text-white">{email}</strong>. Check your inbox for a workspace invite — we'll review your workflow before the call.
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row items-center gap-3"
            style={{ animation: 'fadeSlideUp 0.5s ease 0.5s both' }}
          >
            <button
              onClick={() => navigate('/login')}
              className="axis-gradient-button rounded-full px-8 py-3.5 text-[16px] font-bold"
            >
              Log in to your workspace
            </button>
            <button
              onClick={() => navigate('/')}
              className="rounded-full border border-white/15 px-8 py-3.5 text-[16px] font-semibold text-white/70 transition-colors hover:bg-white/[0.03]"
            >
              Back to home
            </button>
          </div>

          {/* What happens next */}
          <div
            className="mt-14 max-w-lg rounded-[22px] border border-white/8 px-7 py-6 text-left"
            style={{ background: 'var(--surface-card)', animation: 'fadeSlideUp 0.5s ease 0.6s both' }}
          >
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color: COLORS.violet }}>
              What happens next
            </p>
            <ol className="mt-4 space-y-3">
              {[
                "You'll receive a calendar invite confirmation.",
                'We review your workflow submission before the call.',
                'On the call, we walk through your setup and goals.',
                'Within 48h, your recommendation report is ready.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] text-white/65">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #5E149F, #B4308B)' }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </main>
        <PublicFooter />

        {/* Keyframe styles */}
        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE: FORM — original two-step form (unchanged)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-black text-white">
      <PublicNavbar scrolled={scrolled} />

      <main className="pt-28 md:pt-32">
        <div className="px-6 md:px-10">
          <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[0.95fr_1.05fr] items-start">
          <section className="pt-6 md:pt-16">
            <h1 className="max-w-xl text-[40px] md:text-[56px] leading-[1.02] font-bold tracking-[-0.04em] text-white">
              Evaluate your sales tools with confidence.
            </h1>

            <p className="mt-8 max-w-xl text-[24px] leading-[1.35] font-medium text-white/84">
              Tell us about your team, your workflow, and the tools you&apos;re currently using. We&apos;ll analyze your setup and prepare a tailored recommendation through your consultation.
            </p>

            <ul className="mt-12 space-y-3">
              {[
                'A consultation tailored to your current workflow',
                'A clearer view of where your team loses time today',
                'Recommendations based on your stack and process',
                'A practical starting point for your workflow audit',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-white"
                    style={{ background: 'linear-gradient(180deg, #B4308B 0%, #F75A8C 100%)' }}
                  >
                    <CheckCircle2 size={14} />
                  </span>
                  <span className="text-[17px] leading-[1.35] text-white/70">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex min-h-[40rem] flex-col rounded-[28px] p-7 md:p-9 border border-white/8" style={{ background: 'var(--surface-card)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <h1 className="text-center text-[36px] leading-tight font-bold text-white">Book a Consultation</h1>

            {formStep === 1 && (
              <>
                <div className="mt-8 space-y-4">
                  <input
                    className={inputClass}
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Work Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Company Name"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <div className="mt-4 relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={`${inputClass} appearance-none pr-12 cursor-pointer`}
                  >
                    <option value="">Your Team Role</option>
                    {ROLES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none" />
                </div>

                <div className="mt-5 rounded-[22px] border border-white/8 p-5" style={{ background: 'var(--surface-page)' }}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="text-[14px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#E2409B' }}>
                      Team Responsibilities
                    </p>
                    <span className="text-[13px] font-medium text-white/45">
                      Select as many as apply
                    </span>
                  </div>

                  <div
                    className="mt-4 min-h-[min(42dvh,22rem)] max-h-[min(42dvh,22rem)] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-white/[0.06] p-3 pr-2 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]" style={{ background: 'var(--surface-card)' }}
                    role="region"
                    aria-label="Team responsibility options"
                  >
                    <div className="flex flex-wrap gap-3">
                      {ALL_RESPONSIBILITY_OPTIONS.map((item) => {
                        const selected = selectedResponsibilities.includes(item)
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleResponsibility(item)}
                            className="rounded-full border px-4 py-2 text-[14px] font-medium transition-colors text-left"
                            style={{
                              borderColor: selected ? '#B4308B' : 'rgba(255,255,255,0.10)',
                              background: selected ? 'rgba(180, 48, 139, 0.18)' : 'rgba(255,255,255,0.05)',
                              color: selected ? '#F75A8C' : 'rgba(255,255,255,0.65)',
                            }}
                          >
                            {item}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex justify-end pt-8">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canGoToStep2}
                    className="axis-gradient-button rounded-full px-10 py-4 text-[18px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </>
            )}

            {formStep === 2 && (
              <>
                <div className="mt-8 flex min-h-[min(42dvh,22rem)] w-full flex-col gap-4 *:min-h-0">
                  <div className="flex min-h-0 flex-1 flex-col rounded-[22px] border border-white/8 p-5" style={{ background: 'var(--surface-page)' }}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <p
                        className="text-[14px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: '#E2409B' }}
                        id="consultation-workflow-label"
                      >
                        Your workflow
                      </p>
                      <span
                        id="consultation-workflow-prompt"
                        className="text-[13px] font-medium leading-snug text-white/45 sm:max-w-[55%] sm:text-right"
                      >
                        Tell us about your workflow, bottlenecks, and what you&apos;re seeking to improve?
                      </span>
                    </div>
                    <textarea
                      id="consultation-workflow"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Type your response..."
                      aria-labelledby="consultation-workflow-label"
                      aria-describedby="consultation-workflow-prompt"
                      className={`${inputClass} mt-4 min-h-0 flex-1 resize-none`}
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col rounded-[22px] border border-white/8 p-5" style={{ background: 'var(--surface-page)' }}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p
                        className="text-[14px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: '#E2409B' }}
                        id="consultation-tools-label"
                      >
                        Current tools
                      </p>
                      <span id="consultation-tools-prompt" className="text-[13px] font-medium text-white/45 sm:text-right">
                        Current tools you&apos;re using
                      </span>
                    </div>
                    <textarea
                      id="consultation-tools"
                      value={tools}
                      onChange={(e) => setTools(e.target.value)}
                      placeholder="e.g. Salesforce, Outreach, Gong..."
                      aria-labelledby="consultation-tools-label"
                      aria-describedby="consultation-tools-prompt"
                      className={`${inputClass} mt-4 min-h-0 flex-1 resize-none`}
                    />
                  </div>
                </div>

                {submitError && (
                  <p className="mt-3 text-[14px] text-red-500">{submitError}</p>
                )}

                <div className="mt-auto flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className="rounded-full border border-white/15 px-8 py-3.5 text-[16px] font-semibold text-white/70 transition-colors hover:bg-white/[0.05]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!canSubmit || submitting}
                    className="axis-gradient-button rounded-full px-10 py-4 text-[18px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? 'Saving…' : 'Next: Book Your Call'}
                  </button>
                </div>
              </>
            )}
          </section>
          </div>
        </div>

        <section className="px-6 md:px-10 pt-28 md:pt-40 pb-10 md:pb-16">
          <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Built around real workflow',
                body: 'We start with how your team actually works today instead of forcing a canned template.',
              },
              {
                title: 'Recommendations with context',
                body: 'Every suggestion is tied back to bottlenecks, time loss, and the parts of your process that matter most.',
              },
              {
                title: 'Consultative, not generic',
                body: 'Your audit is prepared for your team, your stack, and your sales motion.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border p-7"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'var(--surface-card)',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
                }}
              >
                <h2 className="text-[22px] leading-tight font-bold text-white">{item.title}</h2>
                <p className="mt-4 text-[16px] leading-7 text-white/60">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 md:px-10 py-10 md:py-16 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-[34px] md:text-[46px] leading-tight font-bold text-white">
              How It Works
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {[
                {
                  step: '01',
                  title: 'Understand Your Workflow',
                  body: "We collect data on your team's roles, tasks, and tool usage.",
                },
                {
                  step: '02',
                  title: 'Analyze Performance',
                  body: 'We map your workflow and identify inefficiencies, redundancy, and friction.',
                },
                {
                  step: '03',
                  title: 'Evaluate New Tools',
                  body: 'We simulate how alternative tools would perform in your existing workflow.',
                },
                {
                  step: '04',
                  title: 'Get Clear Recommendations',
                  body: 'You receive a report with recommended tools, expected impact, and confidence level.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-[28px] px-7 py-8 md:px-8 md:py-9 text-white min-h-[188px] flex flex-col justify-center"
                  style={{
                    background: 'linear-gradient(160deg, #5E149F 0%, #B4308B 50%, #F75A8C 100%)',
                    boxShadow: '0 22px 48px rgba(94, 20, 159, 0.14), 0 8px 18px rgba(247, 90, 140, 0.10)',
                  }}
                >
                  <h3 className="text-[28px] md:text-[34px] leading-tight font-bold text-white">{item.title}</h3>
                  <p className="mt-4 text-[16px] md:text-[17px] leading-7 text-white">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-2xl text-[18px] leading-8 text-white/72">
                Start with a quick consultation and we&apos;ll turn your current workflow into a clear plan.
              </p>
              <button
                onClick={() => navigate('/get-started')}
                className="axis-gradient-button inline-flex items-center gap-2 rounded-full px-8 py-4 text-[17px] font-bold transition-transform hover:-translate-y-0.5"
              >
                Get Started
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="px-6 md:px-10 py-6 md:py-10">
          <div
            className="max-w-[1480px] mx-auto rounded-[32px] px-6 py-10 md:px-12 md:py-14"
            style={{ background: 'linear-gradient(180deg, #5E149F 0%, #B4308B 48%, #F75A8C 100%)' }}
          >
            <div className="max-w-3xl">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
                What You Get
              </p>
              <h2 className="mt-4 text-[34px] md:text-[46px] leading-tight font-bold text-white">
                Clear outputs your team can actually use.
              </h2>
              <p className="mt-4 max-w-2xl text-[17px] leading-8 text-white">
                Every audit ends with a structured recommendation package designed to support real decision-making, not just surface-level analysis.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5 items-stretch">
              {[
                {
                  icon: FileText,
                  title: 'Exportable recommendation report',
                  body: 'A concise deliverable you can share internally with stakeholders and leadership.',
                },
                {
                  icon: Clock3,
                  title: 'Time saved estimates',
                  body: 'Practical estimates for where workflow friction can be reduced across the team.',
                },
                {
                  icon: BarChart3,
                  title: 'Productivity impact',
                  body: 'A view into how the right tool could affect throughput and execution quality.',
                },
                {
                  icon: Search,
                  title: 'Tool comparisons',
                  body: 'Side-by-side evaluation grounded in your actual workflow instead of vendor claims.',
                },
                {
                  icon: Target,
                  title: 'Confidence score',
                  body: 'A clearer sense of recommendation strength before your team commits to a purchase.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-[22px] px-6 py-5 min-h-[170px]"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 text-[18px] leading-tight font-bold text-white">{title}</h3>
                  <p className="mt-3 text-[14px] leading-6 text-white/72">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 md:px-10 py-14 md:py-20">
          <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <div>
              <p
                className="text-[13px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: COLORS.violet }}
              >
                Why Axis?
              </p>
              <h2 className="mt-4 text-[34px] md:text-[48px] leading-tight font-bold text-white">
                Not another SaaS management tool.
              </h2>
              <p className="mt-6 max-w-3xl text-[18px] leading-8 text-white/72">
                Unlike traditional platforms that track usage or licenses, we focus on how tools impact real workflows. We evaluate whether a tool improves how your team actually works before you commit to it.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                'We analyze workflow impact rather than just license counts.',
                'We focus on whether a tool improves how your team actually works.',
                'We support better decisions before you commit to a new tool.',
              ].map((point) => (
                <div
                  key={point}
                  className="rounded-[22px] border px-6 py-5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    background: 'var(--surface-card)',
                    boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
                  }}
                >
                  <p className="text-[16px] leading-7 text-white/65">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PublicFooter />
      </main>
    </div>
  )
}

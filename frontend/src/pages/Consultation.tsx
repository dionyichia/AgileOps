import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock3,
  BarChart3,
  Search,
  Target,
} from 'lucide-react'

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
}

const DEFAULT_RESPONSIBILITIES = [
  'Daily task planning',
  'Internal meetings & collaboration',
  'Documentation & reporting',
  'Email & communication management',
  'Cross-functional coordination',
]

const COLORS = {
  white: '#FFFFFF',
  violet: '#5E149F',
}

export default function Consultation() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [loadingResponsibilities, setLoadingResponsibilities] = useState(false)
  const [responsibilities, setResponsibilities] = useState<string[]>([])
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([])
  const [tools, setTools] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!role) return
    setLoadingResponsibilities(true)
    setSelectedResponsibilities([])
    setResponsibilities([])
    const timer = setTimeout(() => {
      const options = ROLE_RESPONSIBILITIES[role] ?? DEFAULT_RESPONSIBILITIES
      setResponsibilities(options)
      setLoadingResponsibilities(false)
    }, 700)
    return () => clearTimeout(timer)
  }, [role])

  const toggleResponsibility = (responsibility: string) => {
    setSelectedResponsibilities((prev) =>
      prev.includes(responsibility)
        ? prev.filter((item) => item !== responsibility)
        : [...prev, responsibility],
    )
  }

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    role &&
    selectedResponsibilities.length > 0 &&
    description.trim().length > 0

  const handleNext = () => {
    localStorage.setItem(
      'axisFormData',
      JSON.stringify({
        firstName,
        lastName,
        email,
        role,
        selectedResponsibilities,
        tools,
        description,
      }),
    )
    navigate('/internal/workflow-report')
  }

  const inputClass =
    'w-full rounded-[18px] border border-black/10 bg-[#F6F6F6] px-5 py-4 text-[15px] text-black outline-none transition-colors placeholder:text-black/35 focus:border-[#B4308B]'

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
          </button>

          <div className="ml-auto flex items-center justify-end gap-4 md:gap-8">
            <nav className="hidden md:flex items-center gap-10 text-[16px] font-medium">
              <button onClick={() => navigate('/#why-axis')} className="transition-opacity hover:opacity-70">
                Why Axis?
              </button>
              <button onClick={() => navigate('/#how-it-works')} className="transition-opacity hover:opacity-70">
                How it Works
              </button>
            </nav>
            <button
              onClick={() => navigate('/login')}
              className="hidden md:inline text-[16px] font-medium transition-opacity hover:opacity-70"
            >
              Client Login
            </button>
            <button className="axis-gradient-button rounded-full px-6 py-3 text-[16px] font-bold">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="pt-12 md:pt-16">
        <div className="px-6 md:px-10">
          <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[0.95fr_1.05fr] items-start">
          <section className="pt-6 md:pt-16">
            <h1 className="max-w-xl text-[40px] md:text-[56px] leading-[1.02] font-bold tracking-[-0.04em] text-black">
              Evaluate your sales tools with confidence.
            </h1>

            <p className="mt-8 max-w-xl text-[24px] leading-[1.35] font-medium text-black/84">
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
                  <span className="text-[17px] leading-[1.35] text-black/70">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white rounded-[28px] p-7 md:p-9 axis-soft-shadow border border-black/5">
            <h1 className="text-center text-[36px] leading-tight font-bold">Book a Consultation</h1>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
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
            </div>

            <div className="mt-4">
              <input
                className={inputClass}
                placeholder="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/45 pointer-events-none" />
            </div>

            <div className="mt-4">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your workflow, key challenges, and what you want to improve."
                rows={6}
                className={`${inputClass} min-h-[170px] resize-none`}
              />
            </div>

            <div className="mt-4">
              <textarea
                value={tools}
                onChange={(e) => setTools(e.target.value)}
                placeholder="Current tools you're using (optional)"
                rows={4}
                className={`${inputClass} min-h-[120px] resize-none`}
              />
            </div>

            {role && (
              <div className="mt-5 rounded-[22px] border border-black/6 bg-[#FAFAFA] p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[14px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#5E149F' }}>
                    Team Responsibilities
                  </p>
                  {responsibilities.length > 0 && (
                    <span className="text-[13px] font-medium text-black/45">
                      Select all that apply
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {loadingResponsibilities && (
                    <p className="text-[15px] text-black/55">Loading recommendations...</p>
                  )}

                  {!loadingResponsibilities && responsibilities.map((item) => {
                    const selected = selectedResponsibilities.includes(item)
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleResponsibility(item)}
                        className="rounded-full border px-4 py-2 text-[14px] font-medium transition-colors"
                        style={{
                          borderColor: selected ? '#B4308B' : 'rgba(0,0,0,0.08)',
                          background: selected ? 'rgba(180, 48, 139, 0.10)' : '#FFFFFF',
                          color: selected ? '#5E149F' : 'rgba(0,0,0,0.72)',
                        }}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                disabled={!canSubmit}
                className="axis-gradient-button rounded-full px-10 py-4 text-[18px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
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
                  borderColor: 'rgba(0,0,0,0.08)',
                  background: COLORS.white,
                  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)',
                }}
              >
                <h2 className="text-[22px] leading-tight font-bold">{item.title}</h2>
                <p className="mt-4 text-[16px] leading-7 text-black/72">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 md:px-10 py-10 md:py-16 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-[34px] md:text-[46px] leading-tight font-bold text-black">
              How It Works
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {[
                {
                  step: '01',
                  title: 'Understand Your Workflow',
                  body: 'We collect data on your team’s roles, tasks, and tool usage.',
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
              <p className="max-w-2xl text-[18px] leading-8 text-black/72">
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
                  className="rounded-[22px] bg-white px-6 py-5 text-black min-h-[170px]"
                  style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(180, 48, 139, 0.10)', color: COLORS.violet }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 text-[18px] leading-tight font-bold">{title}</h3>
                  <p className="mt-3 text-[14px] leading-6 text-black/68">{body}</p>
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
              <h2 className="mt-4 text-[34px] md:text-[48px] leading-tight font-bold text-black">
                Not another SaaS management tool.
              </h2>
              <p className="mt-6 max-w-3xl text-[18px] leading-8 text-black/72">
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
                  className="rounded-[22px] border bg-white px-6 py-5"
                  style={{
                    borderColor: 'rgba(0,0,0,0.08)',
                    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <p className="text-[16px] leading-7 text-black/76">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer
          className="mt-16 md:mt-24 px-6 md:px-10 pt-14 pb-8 text-white"
          style={{ background: 'linear-gradient(180deg, #5E149F 0%, #B4308B 48%, #F75A8C 100%)' }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-12 lg:grid-cols-[1.15fr_1.6fr_0.9fr]">
              <div className="max-w-sm">
                <div className="flex items-center gap-3">
                  <img
                    src="/axis-logo.png"
                    alt="Axis logo"
                    className="h-11 w-11 rounded-2xl object-cover"
                  />
                  <span className="text-[22px] font-bold">Axis</span>
                </div>
                <p className="mt-5 text-[14px] leading-7 text-white/78">
                  We help revenue teams evaluate and select the right tools by analyzing real workflows and delivering data-backed recommendations.
                </p>
              </div>

              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: 'Product',
                    items: ['How It Works', 'Workflow Analysis', 'Tool Evaluation', 'Recommendations', 'Sample Report'],
                  },
                  {
                    title: 'Company',
                    items: ['About', 'Why Axis', 'Contact'],
                  },
                  {
                    title: 'Resources',
                    items: ['FAQs', 'Case Studies', 'Documentation'],
                  },
                  {
                    title: 'Legal',
                    items: ['Privacy Policy', 'Terms of Service', 'Security'],
                  },
                ].map((group) => (
                  <div key={group.title}>
                    <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/68">
                      {group.title}
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {group.items.map((item) => (
                        <li key={item} className="text-[14px] text-white/82">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-white/18 bg-white/10 px-6 py-6 backdrop-blur-sm">
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/68">
                  Get Started
                </p>
                <h3 className="mt-4 text-[24px] leading-tight font-bold">
                  Make your next tool decision with confidence.
                </h3>
                <button
                  onClick={() => navigate('/get-started')}
                  className="mt-6 rounded-full bg-white px-6 py-3 text-[15px] font-bold text-black transition-transform hover:-translate-y-0.5"
                >
                  Get My Recommendation
                </button>
              </div>
            </div>

            <div className="mt-12 border-t border-white/18 pt-6 text-[13px] text-white/64">
              © 2026 Axis. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

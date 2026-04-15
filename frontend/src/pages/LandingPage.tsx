import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Clock3,
  BarChart3,
  Search,
  Target,
} from 'lucide-react'

const COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  violet: '#5E149F',
  orchid: '#B4308B',
  pink: '#E2409B',
  coral: '#F75A8C',
}

const navItems = [
  { label: 'Why Axis?', href: '#why-axis' },
  { label: 'How it Works', href: '#how-it-works' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goToConsultation = () => navigate('/get-started')

  return (
    <div className="min-h-screen bg-white text-black">
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(14px)',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.07)' : '1px solid transparent',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <a href="#top" className="flex items-center">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
          </a>

          <div className="ml-auto flex items-center justify-end gap-3 md:gap-8">
            <nav className="hidden md:flex items-center gap-10 text-[16px] font-medium">
              {navItems.map(({ label, href }) => (
                <a key={href} href={href} className="transition-opacity hover:opacity-70">
                  {label}
                </a>
              ))}
            </nav>
            <button
              onClick={() => navigate('/login')}
              className="hidden md:inline text-[16px] font-medium transition-opacity hover:opacity-70"
            >
              Client Login
            </button>
            <button
              onClick={() => navigate('/internal/login')}
              className="hidden md:inline text-[16px] font-medium transition-opacity hover:opacity-70"
            >
              Admin Login
            </button>
            <button
              onClick={goToConsultation}
              className="axis-gradient-button rounded-full px-6 py-3 text-[15px] md:text-[16px] font-bold transition-transform hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section
          ref={heroRef}
          className="pt-40 pb-20 px-6 md:px-10"
        >
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-[44px] leading-[1.08] md:text-[70px] font-bold tracking-[-0.04em] text-black">
              Stop guessing which tools your sales team needs.
            </h1>

            <p className="mt-8 max-w-3xl mx-auto text-[22px] leading-[1.35] font-medium text-black/80">
              We analyze your team&apos;s workflow and recommend the tools that will <em className="italic font-medium">actually</em> improve productivity.
            </p>

            <button
              onClick={goToConsultation}
              className="axis-gradient-button mt-10 inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-[17px] font-bold transition-transform hover:-translate-y-0.5"
            >
              Get Your Workflow Audit
              <ArrowRight size={18} />
            </button>

            <div className="mt-16 md:mt-20 rounded-[26px] axis-placeholder h-[280px] md:h-[420px] w-full" />
          </div>
        </section>

        <section id="why-axis" className="px-6 md:px-10 py-10 md:py-16">
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

        <section id="how-it-works" className="px-6 md:px-10 py-10 md:py-16 pb-24">
          <div className="max-w-6xl mx-auto">
            <div
              className="text-[34px] md:text-[46px] leading-tight font-bold text-black"
            >
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
                onClick={goToConsultation}
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
                  onClick={goToConsultation}
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

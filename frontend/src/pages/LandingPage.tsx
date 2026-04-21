import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useMotionTemplate,
  type MotionValue,
} from 'motion/react'
import {
  ArrowRight,
  ChevronRight,
  ChevronDown,
  FileText,
  Clock3,
  BarChart3,
  Search,
  Target,
  type LucideIcon,
} from 'lucide-react'
import {
  TextGenerateEffect,
} from '../components/ui/text-generate-effect'
import { NoiseCanvas } from '../components/ui/noise-canvas'
import PublicNavbar from '../components/public/PublicNavbar'
import PublicFooter from '../components/public/PublicFooter'

gsap.registerPlugin(ScrollTrigger)

const trustedByLogos = [
  {
    src: '/berkeley-logo.png',
    alt: 'Berkeley',
  },
]

const trustedBySequence = Array.from({ length: 8 }, (_, index) => ({
  ...trustedByLogos[index % trustedByLogos.length],
  id: index,
}))
const trustedByTrack = [...trustedBySequence, ...trustedBySequence]

const HEADLINE_TEXT = 'Your sales tools make big promises. We tell you if they\'re true for your team.'
const HEADLINE_STAGGER = 0.2
const HEADLINE_DURATION = 0.5
const HEADLINE_INITIAL_DELAY = 0.3

const HOW_IT_WORKS_HEADING = 'From interview to recommendation — in four steps.'
const howItWorksHeadingDelay = 0.15
const howItWorksHeadingDuration = 0.4
const howItWorksHeadingStagger = 0.12

const GRADIENT_TEXT_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(90deg, #5E149F 0%, #B4308B 38%, #E2409B 72%, #F75A8C 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Interview Your Team',
    body: 'We sit down with your reps and ops leads to understand how deals actually move — calls, tasks, tools, and every handoff in between.',
    accent: 'rgba(94, 20, 159, 0.35)',
  },
  {
    step: '02',
    title: 'Map Your Workflow',
    body: 'We reconstruct your real sales pipeline as a workflow graph, capturing every node, transition, and the places where time quietly gets lost.',
    accent: 'rgba(180, 48, 139, 0.35)',
  },
  {
    step: '03',
    title: 'Simulate Tool Impact',
    body: 'We run thousands of Monte Carlo simulations across your actual workflow to model exactly what happens if a new tool enters the picture.',
    accent: 'rgba(226, 64, 155, 0.35)',
  },
  {
    step: '04',
    title: 'Deliver Your Recommendation',
    body: 'You receive a clear, data-backed recommendation: which tool fits, why it fits, and the productivity improvement you can realistically expect.',
    accent: 'rgba(247, 90, 140, 0.35)',
  },
]

const WHAT_YOU_GET_ITEMS: Array<{
  icon: LucideIcon
  title: string
  body: string
}> = [
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
]

interface StackCardProps {
  index: number
  total: number
  scrollProgress: MotionValue<number>
  step: string
  title: string
  body: string
  accent: string
}

const CARD_H = 360 // px
const STACK_STAGE_GAP = `calc(100vh - ${CARD_H}px)`
const WHAT_YOU_GET_STAGE_HEIGHT = '72vh'
const WHAT_YOU_GET_END_HOLD = '42vh'

function StackCard({ index, total, scrollProgress, step, title, body, accent }: StackCardProps) {
  const isLast = index === total - 1
  const shouldScale = index < total - 2
  const scaleStart = (index + 1) / total
  const scale = useTransform(
    scrollProgress,
    shouldScale ? [scaleStart - 0.04, scaleStart + 0.08] : [0, 1],
    shouldScale ? [1, 0.93] : [1, 1],
  )

  return (
    <motion.div
      style={{
        position: 'sticky',
        // Center card in the viewport (below the navbar)
        top: `calc(50vh - ${CARD_H / 2}px)`,
        zIndex: index + 1,
        scale,
        transformOrigin: 'top center',
        willChange: shouldScale ? 'transform' : 'auto',
        height: `${CARD_H}px`,
        marginBottom: isLast ? 0 : STACK_STAGE_GAP,
      }}
      className="mx-auto max-w-5xl px-6 md:px-10"
    >
      <div
        className="relative w-full h-full rounded-[28px] border overflow-hidden flex flex-col justify-between px-10 py-8 md:px-14 md:py-9"
        style={{
          borderColor: 'rgba(255,255,255,0.2)',
          background: 'rgb(16,16,20)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Static glows keep the look without forcing continuous blur animation during scroll. */}
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: '70%',
            height: '180%',
            right: '-15%',
            bottom: '-60%',
            background: `radial-gradient(circle, ${accent} 0%, transparent 65%)`,
            filter: 'blur(36px)',
            opacity: 0.85,
          }}
        />
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: '40%',
            height: '120%',
            left: '-10%',
            top: '-40%',
            background: `radial-gradient(circle, ${accent.replace('0.35', '0.2')} 0%, transparent 65%)`,
            filter: 'blur(32px)',
            opacity: 0.8,
          }}
        />

        {/* Step counter — top row */}
        <div className="flex items-center justify-between relative z-10">
          <span
            className="text-[13px] font-semibold uppercase tracking-[0.2em]"
            style={GRADIENT_TEXT_STYLE}
          >
            {step} / {String(total).padStart(2, '0')}
          </span>
          <span className="text-[13px] font-medium text-white uppercase tracking-[0.15em]">
            How It Works
          </span>
        </div>

        {/* Main content */}
        <div className="relative z-10 max-w-2xl">
          <div
            className="text-[64px] md:text-[86px] font-bold leading-none mb-2 select-none"
            style={GRADIENT_TEXT_STYLE}
            aria-hidden
          >
            {step}
          </div>
          <h3 className="text-[28px] md:text-[38px] leading-tight font-bold text-white text-balance">
            {title}
          </h3>
          <p className="mt-3 text-[15px] md:text-[17px] leading-7 text-white text-balance max-w-lg">
            {body}
          </p>
        </div>

        {/* Bottom progress dots */}
        <div className="flex items-center gap-2 relative z-10">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? '24px' : '6px',
                height: '6px',
                background:
                  i === index
                    ? 'linear-gradient(90deg, #5E149F, #F75A8C)'
                    : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function WhatYouGetDot({
  index,
  active,
}: {
  index: number
  active: boolean
}) {
  return (
    <motion.div
      className="rounded-full"
      animate={{
        width: active ? 40 : 8,
        opacity: active ? 1 : 0.28,
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.6 }}
      style={{
        height: 8,
        background: 'linear-gradient(90deg, #5E149F, #F75A8C)',
      }}
    />
  )
}

function WhatYouGetSlider({
  scrollProgress,
}: {
  scrollProgress: MotionValue<number>
}) {
  const total = WHAT_YOU_GET_ITEMS.length
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const unsubscribe = scrollProgress.on('change', latest => {
      const nextIndex = Math.max(0, Math.min(total - 1, Math.round(latest * (total - 1))))
      setActiveIndex(prev => (prev === nextIndex ? prev : nextIndex))
    })

    return () => unsubscribe()
  }, [scrollProgress, total])

  return (
    <div
      className="relative h-full overflow-hidden rounded-[32px] border"
      style={{
        borderColor: 'rgba(255,255,255,0.1)',
        background: 'rgba(14,14,18,0.96)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}
    >
      <motion.div
        className="flex h-full"
        animate={{
          x: `-${activeIndex * (100 / total)}%`,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 34, mass: 0.9 }}
        style={{ width: `${total * 100}%`, willChange: 'transform' }}
      >
        {WHAT_YOU_GET_ITEMS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="h-full px-10 py-10 text-white xl:px-14 xl:py-12"
            style={{ width: `${100 / total}%` }}
          >
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Icon size={24} className="text-white" />
                </div>
                <div className="max-w-xl">
                  <h3 className="text-[28px] leading-tight font-bold text-white xl:text-[34px]">
                    {title}
                  </h3>
                  <p className="mt-6 text-[18px] leading-8 text-white/72 xl:max-w-2xl">
                    {body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-center gap-3 xl:bottom-12">
        {WHAT_YOU_GET_ITEMS.map((_, index) => (
          <WhatYouGetDot
            key={index}
            index={index}
            active={index === activeIndex}
          />
        ))}
      </div>
    </div>
  )
}

function StrokeHeading({ text, play }: { text: string; play: boolean }) {
  const animationId = useId().replace(/:/g, '')
  const lines = ['Not another', 'SaaS management tool.']

  return (
    <div className="relative mt-4 h-[138px] w-full md:h-[188px]">
      <style>{`
        @keyframes axis-stroke-fill-${animationId} {
          0% {
            fill: rgba(255,255,255,0);
            stroke: rgba(180,48,139,1);
            stroke-dashoffset: 25%;
            stroke-dasharray: 0 50%;
            stroke-width: 2;
          }
          70% {
            fill: rgba(255,255,255,0);
            stroke: rgba(180,48,139,1);
          }
          80% {
            fill: rgba(255,255,255,0);
            stroke: rgba(226,64,155,1);
            stroke-width: 3;
          }
          100% {
            fill: rgba(255,255,255,1);
            stroke: rgba(247,90,140,0);
            stroke-dashoffset: -25%;
            stroke-dasharray: 50% 0;
            stroke-width: 0;
          }
        }

        .axis-stroke-text-${animationId} {
          paint-order: stroke fill;
        }
      `}</style>
      <h2 className="sr-only">{text}</h2>
      <svg
        viewBox="0 0 1200 240"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <text
          x="0"
          y="90"
          fill="#FFFFFF"
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '88px',
            fontWeight: 700,
          }}
        >
          {lines.map((line, index) => (
            <tspan key={line} x="0" dy={index === 0 ? 0 : 90}>
              {line}
            </tspan>
          ))}
        </text>
        <text
          x="0"
          y="90"
          className={`axis-stroke-text-${animationId}`}
          fill="rgba(255,255,255,0)"
          stroke="rgba(180,48,139,1)"
          strokeWidth="2"
          strokeDasharray="0 50%"
          strokeDashoffset="25%"
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '88px',
            fontWeight: 700,
            animation: play ? `axis-stroke-fill-${animationId} 3.2s ease-out 1 forwards` : 'none',
          }}
        >
          {lines.map((line, index) => (
            <tspan key={line} x="0" dy={index === 0 ? 0 : 90}>
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const howItWorksIntroRef = useRef<HTMLDivElement>(null)
  const whatYouGetRef = useRef<HTMLDivElement>(null)
  const whyAxisHeadingRef = useRef<HTMLDivElement>(null)
  const pageMouseX = useMotionValue(-9999)
  const pageMouseY = useMotionValue(-9999)
  const heroMouseX = useMotionValue(-9999)
  const heroMouseY = useMotionValue(-9999)
  const pageGlowBackground = useMotionTemplate`radial-gradient(600px circle at ${pageMouseX}px ${pageMouseY}px, rgba(178,80,255,0.14), transparent 60%)`
  const heroGlowBackground = useMotionTemplate`radial-gradient(600px circle at ${heroMouseX}px ${heroMouseY}px, rgba(178,80,255,0.12), transparent 60%)`

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end start'],
  })

  const { scrollYProgress: stackScrollProgress } = useScroll({
    target: stackRef,
    offset: ['start start', 'end end'],
  })
  const { scrollYProgress: whatYouGetProgress } = useScroll({
    target: whatYouGetRef,
    offset: ['start start', 'end end'],
  })
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -40])
  const videoScale = useTransform(scrollYProgress, [0, 0.6], [1.25, 1.0])
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0])
  const howItWorksHeadingInView = useInView(howItWorksIntroRef, {
    once: true,
    margin: '-20% 0px -35% 0px',
  })
  const whyAxisHeadingInView = useInView(whyAxisHeadingRef, {
    margin: '-20% 0px -20% 0px',
  })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const scope = pageRef.current
    if (!scope) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const ctx = gsap.context(() => {
      const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } })

      heroTimeline
        .fromTo(
          '[data-gsap-hero-subheadline]',
          { autoAlpha: 0, y: 26, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.75 },
          0.7,
        )
        .fromTo(
          '[data-gsap-hero-cta]',
          { autoAlpha: 0, y: 26, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.72, stagger: 0.1 },
          0.95,
        )
        .fromTo(
          '[data-gsap-hero-trust]',
          { autoAlpha: 0, y: 22, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7 },
          1.15,
        )
        .fromTo(
          '[data-gsap-hero-scroll]',
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.55 },
          1.55,
        )

      gsap.utils.toArray<HTMLElement>('[data-gsap-reveal-group]').forEach((group) => {
        const targets = group.matches('[data-gsap-reveal-item]')
          ? [group]
          : gsap.utils.toArray<HTMLElement>('[data-gsap-reveal-item]', group)

        if (!targets.length) return

        gsap.fromTo(
          targets,
          {
            autoAlpha: 0,
            y: 30,
            filter: 'blur(12px)',
          },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
            clearProps: 'filter',
            scrollTrigger: {
              trigger: group,
              start: 'top 78%',
              once: true,
            },
          },
        )
      })

      if (heroRef.current) {
        gsap.to('[data-gsap-hero-video]', {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1.1,
          },
        })
      }
    }, scope)

    return () => ctx.revert()
  }, [])

  const goToConsultation = () => navigate('/get-started')

  return (
    <div
      ref={pageRef}
      className="min-h-screen bg-black text-white"
      onMouseMove={e => {
        pageMouseX.set(e.clientX)
        pageMouseY.set(e.clientY)
      }}
    >
      {/* ───── Animated noise texture ───── */}
      <NoiseCanvas opacity={0.06} />

      {/* ───── Page-level ambient cursor glow ───── */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{ background: pageGlowBackground }}
      />

      {/* ───── Navbar ───── */}
      <PublicNavbar scrolled={scrolled} />

      <main id="top">
        {/* ───── Hero ───── */}
        <div ref={wrapperRef} style={{ height: '200vh' }}>
          <section
            ref={heroRef}
            className="relative overflow-hidden flex items-center justify-center"
            style={{ position: 'sticky', top: 0, height: '100vh' }}
            onMouseMove={e => {
              heroMouseX.set(e.clientX)
              heroMouseY.set(e.clientY)
            }}
          >
            {/* Video background — scroll-driven zoom-out */}
            <motion.div
              className="absolute inset-0"
              style={{ scale: videoScale }}
            >
              <div data-gsap-hero-video className="absolute inset-0">
                <video
                  src="/hero.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Dark gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(8,12,24,0.72) 0%, rgba(8,12,24,0.55) 50%, rgba(8,12,24,0.88) 100%)',
              }}
            />

            {/* Hero cursor spotlight */}
            <motion.div
              className="absolute inset-0 pointer-events-none z-10"
              style={{ background: heroGlowBackground }}
            />

            {/* Foreground content */}
            <motion.div
              className="relative z-20 max-w-5xl mx-auto text-center px-6 md:px-10 pt-32 md:pt-32 pb-56 md:pb-28"
              style={{ y: headlineY }}
            >
              {/* Headline — word-by-word TextGenerateEffect */}
              <TextGenerateEffect
                text={HEADLINE_TEXT}
                duration={HEADLINE_DURATION}
                staggerDelay={HEADLINE_STAGGER}
                delay={HEADLINE_INITIAL_DELAY}
                className="text-[44px] leading-[1.08] md:text-[70px] font-bold tracking-[-0.04em] text-white text-balance max-w-4xl mx-auto"
              />

              {/* Subheadline */}
              <motion.p
                data-gsap-hero-subheadline
                className="mt-8 max-w-3xl mx-auto text-[22px] leading-[1.35] font-medium text-white/75 text-balance"
              >
                We analyze your team&apos;s workflow and recommend the tools that
                will <em className="italic font-medium">actually</em> improve
                productivity.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                {/* Primary CTA */}
                <motion.button
                  data-gsap-hero-cta
                  onClick={goToConsultation}
                  className="axis-gradient-button inline-flex items-center justify-center gap-2 rounded-full border-2 border-white px-8 py-4 text-[17px] font-bold text-white"
                  style={{ border: '2px solid white' }}
                  whileHover={{
                    scale: 1.018,
                    boxShadow: '0 0 28px rgba(247,90,140,0.4)',
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  Get Your Workflow Audit
                  <ArrowRight size={18} />
                </motion.button>

                {/* Secondary ghost CTA */}
                <motion.button
                  data-gsap-hero-cta
                  onClick={() => {
                    document
                      .getElementById('how-it-works')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="liquid-glass text-white border border-white/25 rounded-full px-8 py-4 text-[17px] font-bold"
                  whileHover={{
                    scale: 1.018,
                    boxShadow: '0 0 28px rgba(247,90,140,0.4)',
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  See How It Works
                </motion.button>
              </motion.div>

              <motion.div
                data-gsap-hero-trust
                className="mt-16 flex w-full flex-col items-center gap-2"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Trusted By
                </p>
                <div
                  className="w-full overflow-hidden"
                  style={{
                    maskImage:
                      'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                  }}
                >
                  <div className="marquee-track flex w-max items-center">
                    {trustedByTrack.map(({ src, alt, id }, i) => (
                      <img
                        key={`${alt}-${id}-${i}`}
                        src={src}
                        alt={alt}
                        className="mx-8 h-16 w-auto flex-shrink-0 opacity-40 grayscale md:mx-16 md:h-24"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Scroll down indicator */}
            <motion.div
              data-gsap-hero-scroll
              className="absolute bottom-4 md:bottom-8 inset-x-0 z-20 flex flex-col items-center gap-1 pointer-events-none"
              style={{ opacity: scrollIndicatorOpacity }}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/30">
                Scroll down
              </span>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronDown size={16} className="text-white/30" />
              </motion.div>
            </motion.div>

            {/* Bottom gradient fade to black */}
            <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-b from-transparent to-black" />
          </section>
        </div>

        {/* ───── Why Axis? cards ───── */}
        <section id="why-axis" className="px-6 md:px-10 py-10 md:py-16 scroll-mt-24">
          <div data-gsap-reveal-group className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
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
              <motion.div
                data-gsap-reveal-item
                key={item.title}
                className="rounded-[24px] border p-7"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                <h2 className="text-[22px] leading-tight font-bold text-white text-balance">{item.title}</h2>
                <p className="mt-4 text-[16px] leading-7 text-white/70 text-balance">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ───── How It Works (stacking cards) ───── */}
        <section id="how-it-works" className="scroll-mt-24">
          <div ref={stackRef} style={{ position: 'relative' }}>
            <motion.div
              ref={howItWorksIntroRef}
              data-gsap-reveal-group
              data-gsap-reveal-item
              className="mx-auto max-w-5xl px-6 md:px-10"
              style={{
                position: 'sticky',
                top: `calc(50vh - ${CARD_H / 2}px)`,
                zIndex: 0,
                height: `${CARD_H}px`,
                marginBottom: STACK_STAGE_GAP,
              }}
            >
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-4">
                  How It Works
                </p>
                <TextGenerateEffect
                  as="h2"
                  text={HOW_IT_WORKS_HEADING}
                  duration={howItWorksHeadingDuration}
                  staggerDelay={howItWorksHeadingStagger}
                  delay={howItWorksHeadingDelay}
                  play={howItWorksHeadingInView}
                  className="text-[34px] md:text-[52px] leading-tight font-bold text-white text-balance"
                />
              </div>
            </motion.div>

            {HOW_IT_WORKS_STEPS.map((item, i) => (
              <StackCard
                key={item.step}
                index={i}
                total={HOW_IT_WORKS_STEPS.length}
                scrollProgress={stackScrollProgress}
                step={item.step}
                title={item.title}
                body={item.body}
                accent={item.accent}
              />
            ))}

            <div style={{ height: STACK_STAGE_GAP }} />
          </div>

          <div data-gsap-reveal-group className="px-6 pb-6 pt-10 text-center md:px-10 md:pb-10">
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4">
              <p data-gsap-reveal-item className="max-w-2xl text-[18px] leading-8 text-white/70 text-balance">
                Start with a quick consultation and we&apos;ll turn your current workflow into a clear plan.
              </p>
              <button
                data-gsap-reveal-item
                onClick={goToConsultation}
                className="bg-white text-black inline-flex items-center gap-2 rounded-full border-2 border-white px-8 py-4 text-[17px] font-bold transition-transform hover:-translate-y-0.5"
              >
                Get Started
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* ───── What You Get ───── */}
        <section className="px-6 md:px-10 py-6 md:py-10">
          <div className="max-w-[1480px] mx-auto rounded-[32px] px-6 py-10 md:px-12 md:py-14">
            <div className="lg:hidden">
              <motion.div
                data-gsap-reveal-group
                data-gsap-reveal-item
                className="max-w-3xl"
              >
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  What You Get
                </p>
                <h2 className="mt-4 text-[34px] md:text-[46px] leading-tight font-bold text-white text-balance">
                  Clear outputs your team can actually use.
                </h2>
                <p className="mt-4 max-w-2xl text-[17px] leading-8 text-white/70 text-balance">
                  Every audit ends with a structured recommendation package designed to support real decision-making, not just surface-level analysis.
                </p>
              </motion.div>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                <div data-gsap-reveal-group className="contents">
                {WHAT_YOU_GET_ITEMS.map(({ icon: Icon, title, body }, i) => (
                  <motion.div
                    data-gsap-reveal-item
                    key={title}
                    className="rounded-[22px] bg-white/[0.04] px-6 py-5 text-white flex flex-col"
                    style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.12)' }}
                  >
                    <div className={`flex items-start gap-3 ${i === 0 ? 'min-h-[44px]' : 'min-h-[64px]'}`}>
                      <Icon size={20} className="text-white flex-shrink-0 mt-0.5" />
                      <h3 className="text-[16px] leading-tight font-bold text-white text-balance">{title}</h3>
                    </div>
                    <p className="mt-3 text-[14px] leading-6 text-white/70 text-balance">{body}</p>
                  </motion.div>
                ))}
                </div>
              </div>
            </div>

            <div
              ref={whatYouGetRef}
              className="relative hidden lg:block"
              style={{ height: `calc(${WHAT_YOU_GET_ITEMS.length} * ${WHAT_YOU_GET_STAGE_HEIGHT} + ${WHAT_YOU_GET_END_HOLD})` }}
            >
              <div data-gsap-reveal-group className="sticky top-24 grid min-h-[calc(100vh-6rem)] grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-12 xl:gap-20">
                <motion.div
                  data-gsap-reveal-group
                  data-gsap-reveal-item
                  className="max-w-3xl"
                >
                  <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    What You Get
                  </p>
                  <h2 className="mt-4 text-[44px] leading-[1.06] font-bold text-white text-balance xl:text-[58px]">
                    Clear outputs your team can actually use.
                  </h2>
                  <p className="mt-6 max-w-2xl text-[20px] leading-9 text-white/70 text-balance">
                    Every audit ends with a structured recommendation package designed to support real decision-making, not just surface-level analysis.
                  </p>
                </motion.div>

                <div data-gsap-reveal-item className="relative h-[470px] xl:h-[520px]">
                  <WhatYouGetSlider scrollProgress={whatYouGetProgress} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── Why Axis? comparison ───── */}
        <section className="px-6 md:px-10 py-14 md:py-20">
          <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <motion.div
              data-gsap-reveal-group
              data-gsap-reveal-item
            >
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Why Axis?
              </p>
              <div ref={whyAxisHeadingRef}>
                <StrokeHeading text="Not another SaaS management tool." play={whyAxisHeadingInView} />
              </div>
              <p className="mt-6 max-w-3xl text-[18px] leading-8 text-white/70 text-balance">
                Unlike traditional platforms that track usage or licenses, we focus on how tools impact real workflows. We evaluate whether a tool improves how your team actually works before you commit to it.
              </p>
            </motion.div>

            <div data-gsap-reveal-group className="grid gap-4">
              {[
                'We analyze workflow impact rather than just license counts.',
                'We focus on whether a tool improves how your team actually works.',
                'We support better decisions before you commit to a new tool.',
              ].map((point) => (
                <motion.div
                  data-gsap-reveal-item
                  key={point}
                  className="rounded-[22px] border bg-white/[0.04] px-6 py-5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    boxShadow: '0 18px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.4)',
                  }}
                >
                  <p className="text-[16px] leading-7 text-white/70 text-balance">{point}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Footer ───── */}
        <PublicFooter />
      </main>
    </div>
  )
}

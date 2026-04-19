import { RefObject, useEffect } from 'react'
import gsap from 'gsap'

type RevealOptions = {
  selectors?: string[]
  duration?: number
  stagger?: number
  y?: number
  blur?: number
  startDelay?: number
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useGsapReveal(
  scopeRef: RefObject<HTMLElement | null>,
  dependencies: ReadonlyArray<unknown> = [],
  {
    selectors = ['[data-gsap-reveal]'],
    duration = 0.58,
    stagger = 0.08,
    y = 18,
    blur = 10,
    startDelay = 0,
  }: RevealOptions = {},
) {
  useEffect(() => {
    const scope = scopeRef.current

    if (!scope || prefersReducedMotion()) return

    const targets = selectors.flatMap((selector) => gsap.utils.toArray<HTMLElement>(selector, scope))

    if (!targets.length) return

    const ctx = gsap.context(() => {
      gsap.set(targets, {
        autoAlpha: 0,
        y,
        filter: `blur(${blur}px)`,
        willChange: 'transform, opacity, filter',
      })

      gsap.to(targets, {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration,
        delay: startDelay,
        stagger,
        ease: 'power3.out',
        clearProps: 'filter,willChange',
      })
    }, scope)

    return () => ctx.revert()
  }, dependencies)
}

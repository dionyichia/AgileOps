import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon } from 'lucide-react'
import gsap from 'gsap'
import { auth } from '../../api/client'
import { useGsapReveal } from '../../hooks/useGsapReveal'
import { useTheme } from '../../hooks/useTheme'

interface ClientWorkspaceShellProps {
  /** Left side of the top bar (titles, back button, logo, etc.) */
  headerLeft?: ReactNode
  children: ReactNode
  /** When provided, nav links use project-scoped paths */
  projectId?: string
}

/**
 * Shared client workspace chrome: profile + hamburger with consistent nav drawer.
 * Use on dashboard, simulations, drafts, reports, tool input, simulation results, recommendation, etc.
 */
export default function ClientWorkspaceShell({ headerLeft, children, projectId }: ClientWorkspaceShellProps) {
  const navigate = useNavigate()
  const dashboardPath = projectId ? `/projects/${projectId}/dashboard` : '/dashboard'
  const [showMenu, setShowMenu] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLElement>(null)

  const handleSignOut = async () => {
    setShowMenu(false)
    await auth.logout()
    navigate('/login')
  }

  useGsapReveal(rootRef, [], {
    selectors: ['[data-gsap-shell-header]', '[data-gsap-shell-content]'],
    duration: 0.62,
    stagger: 0.1,
    y: 18,
    blur: 10,
  })

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) return

    if (showMenu) {
      const items = gsap.utils.toArray<HTMLElement>('[data-gsap-menu-item]', menu)

      gsap.killTweensOf([menu, ...items])
      gsap.set(menu, { xPercent: 100, autoAlpha: 1, willChange: 'transform' })
      gsap.set(items, { x: 18, autoAlpha: 0, willChange: 'transform, opacity' })

      const tl = gsap.timeline()
      tl.to(menu, {
        xPercent: 0,
        duration: 0.34,
        ease: 'power3.out',
        clearProps: 'willChange',
      }).to(items, {
        x: 0,
        autoAlpha: 1,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'willChange',
      }, '-=0.18')

      return () => {
        tl.kill()
      }
    }

    gsap.set(menu, { clearProps: 'all' })
  }, [showMenu])

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col page-bg text-black">
      <header data-gsap-shell-header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1480px] items-start justify-between gap-4 px-4 py-4 md:px-6 lg:px-10">
          <div className="min-w-0 flex-1">{headerLeft}</div>
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black/72 transition-colors hover:bg-black/[0.03]"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black/72 transition-colors hover:bg-black/[0.03]"
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <div data-gsap-shell-content className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>

      {showMenu && (
        <aside ref={menuRef} className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[320px] flex-col border-l border-black/15 bg-[var(--surface-drawer)] shadow-2xl">
          <div className="px-4 py-4">
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-black/75 transition-colors hover:bg-black/[0.04]"
              aria-label="Close menu"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="flex-1 px-6 pt-8 sm:px-8">
            <nav className="space-y-4 text-right">
              <button
                onClick={() => { setShowMenu(false); navigate(dashboardPath) }}
                data-gsap-menu-item
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-axispurple-900 md:text-[28px]"
              >
                Dashboard
              </button>
              <button
                onClick={() => void handleSignOut()}
                data-gsap-menu-item
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-axispurple-900 md:text-[28px]"
              >
                Sign out
              </button>
            </nav>
          </div>
        </aside>
      )}
    </div>
  )
}

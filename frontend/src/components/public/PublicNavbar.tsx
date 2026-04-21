import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import {
  MotionHighlight,
  MotionHighlightItem,
} from '../ui/motion-highlight'

interface PublicNavbarProps {
  scrolled?: boolean
}

export default function PublicNavbar({
  scrolled = false,
}: PublicNavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    {
      label: 'Why Axis?',
      href: location.pathname === '/' ? '#why-axis' : '/#why-axis',
    },
    {
      label: 'How it Works',
      href: location.pathname === '/' ? '#how-it-works' : '/#how-it-works',
    },
  ]

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-4 sm:px-4 sm:pt-5 md:px-5 md:pt-6"
    >
      <div
        className="liquid-glass mx-auto w-full max-w-[min(100%,90rem)] rounded-[28px] border px-4 py-2 sm:px-5 md:rounded-full md:px-6 md:py-2.5"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor: scrolled
            ? 'rgba(255,255,255,0.16)'
            : 'rgba(255,255,255,0.1)',
          boxShadow: scrolled
            ? '0 18px 48px rgba(0,0,0,0.28)'
            : '0 10px 28px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex items-center justify-between gap-3 md:gap-5">
          <a href={location.pathname === '/' ? '#top' : '/'} className="flex items-center">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-9 w-auto rounded-lg md:h-10"
            />
          </a>

          <div className="ml-auto flex items-center justify-end gap-2.5 sm:gap-3 md:gap-5">
            <MotionHighlight
              hover
              mode="children"
              className="hidden rounded-full bg-white/[0.08] md:flex"
            >
              <nav className="flex items-center gap-2 text-[16px] font-medium">
                {navItems.map(({ label, href }) => (
                  <MotionHighlightItem key={href} asChild>
                    <a
                      href={href}
                      className="px-3 py-1.5 text-white transition-opacity hover:opacity-70"
                    >
                      {label}
                    </a>
                  </MotionHighlightItem>
                ))}
              </nav>
              <MotionHighlightItem asChild>
                <button
                  onClick={() => navigate('/login')}
                  className="px-3 py-1.5 text-[16px] font-medium text-white transition-opacity hover:opacity-70"
                >
                  Client Login
                </button>
              </MotionHighlightItem>
              <MotionHighlightItem asChild>
                <button
                  onClick={() => navigate('/internal/login')}
                  className="px-3 py-1.5 text-[16px] font-medium text-white transition-opacity hover:opacity-70"
                >
                  Admin Login
                </button>
              </MotionHighlightItem>
            </MotionHighlight>
            <button
              onClick={() => navigate('/get-started')}
              className="rounded-full border-2 border-white bg-white px-4 py-2 text-[13px] font-bold text-black transition-transform hover:-translate-y-0.5 sm:px-5 md:px-6 md:py-2.5 md:text-[16px]"
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-white transition-opacity hover:opacity-80 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <ChevronDown
                size={18}
                className={`transition-transform duration-300 ${mobileMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{
            height: mobileMenuOpen ? 'auto' : 0,
            opacity: mobileMenuOpen ? 1 : 0,
            marginTop: mobileMenuOpen ? 12 : 0,
          }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="overflow-hidden md:hidden"
        >
          <MotionHighlight
            hover
            mode="children"
            className="flex flex-col rounded-[24px] bg-white/[0.08] p-1"
          >
            <nav className="flex flex-col text-[15px] font-medium text-white">
              {navItems.map(({ label, href }) => (
                <MotionHighlightItem key={href} asChild>
                  <a
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-[20px] px-4 py-3 transition-opacity hover:opacity-70"
                  >
                    {label}
                  </a>
                </MotionHighlightItem>
              ))}
            </nav>
            <MotionHighlightItem asChild>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/login')
                }}
                className="rounded-[20px] px-4 py-3 text-left text-[15px] font-medium text-white transition-opacity hover:opacity-70"
              >
                Client Login
              </button>
            </MotionHighlightItem>
            <MotionHighlightItem asChild>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/internal/login')
                }}
                className="rounded-[20px] px-4 py-3 text-left text-[15px] font-medium text-white transition-opacity hover:opacity-70"
              >
                Admin Login
              </button>
            </MotionHighlightItem>
          </MotionHighlight>
        </motion.div>
      </div>
    </motion.header>
  )
}

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'

interface ClientWorkspaceShellProps {
  /** Left side of the top bar (titles, back button, logo, etc.) */
  headerLeft?: ReactNode
  children: ReactNode
}

/**
 * Shared client workspace chrome: profile + hamburger with consistent nav drawer.
 * Use on dashboard, simulations, drafts, reports, tool input, simulation results, recommendation, etc.
 */
export default function ClientWorkspaceShell({ headerLeft, children }: ClientWorkspaceShellProps) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1480px] items-start justify-between gap-4 px-6 py-4 md:px-10">
          <div className="min-w-0 flex-1">{headerLeft}</div>
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <button
              type="button"
              className="h-11 w-11 rounded-full text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #5E149F 0%, #F75A8C 100%)' }}
              aria-label="Profile"
            />
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

      {children}

      {showMenu && (
        <aside className="fixed right-0 top-0 z-50 flex h-screen w-[300px] flex-col border-l border-black/15 bg-[#F7F7FB] shadow-2xl">
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

          <div className="flex-1 px-8 pt-8">
            <nav className="space-y-4 text-right">
              <button
                onClick={() => {
                  setShowMenu(false)
                  navigate('/dashboard')
                }}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setShowMenu(false)
                  navigate('/simulations')
                }}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Simulations
              </button>
              <button
                onClick={() => {
                  setShowMenu(false)
                  navigate('/tool-drafts')
                }}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Tool Drafts
              </button>
              <button
                onClick={() => {
                  setShowMenu(false)
                  navigate('/reports')
                }}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Reports
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Team
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Settings
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="block w-full text-right text-[24px] leading-tight tracking-[-0.015em] text-black hover:text-[#5E149F] md:text-[28px]"
              >
                Help
              </button>
            </nav>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-black/20 px-8 py-8">
            <div className="text-[38px] leading-[1.04] tracking-[-0.03em] text-black">
              <div>Hello</div>
              <div>Name of User</div>
            </div>
            <div
              className="h-11 w-11 rounded-full"
              style={{ background: 'linear-gradient(135deg, #5E149F 0%, #F75A8C 100%)' }}
            />
          </div>
        </aside>
      )}
    </div>
  )
}

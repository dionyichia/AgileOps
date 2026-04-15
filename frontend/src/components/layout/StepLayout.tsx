import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface StepLayoutProps {
  children: React.ReactNode
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  showBack?: boolean
  backPath?: string
  hideNextButton?: boolean
  /** No header, no footer — for client /toolinput nested inside ClientWorkspaceShell */
  compact?: boolean
  /** When compact: render only children (parent provides chrome) */
  nested?: boolean
  /** No header; keep footer — use under ClientWorkspaceShell on flat client routes */
  embedded?: boolean
  // Legacy props kept for call-site compatibility — no longer rendered
  currentStep?: number
  title?: string
  subtitle?: string
}

export default function StepLayout({
  children,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  showBack = true,
  backPath,
  hideNextButton = false,
  compact = false,
  nested = false,
  embedded = false,
}: StepLayoutProps) {
  const navigate = useNavigate()

  const handleBack = () => navigate(backPath ?? '/dashboard')

  if (compact) {
    if (nested) {
      return (
        <div className="w-full text-black">
          {children}
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-[#F7F4FB] flex flex-col text-black">
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 animate-fade-in">
          {children}
        </main>
      </div>
    )
  }

  if (embedded) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col bg-[#F7F4FB] text-black">
        <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 animate-fade-in overflow-auto px-6 py-6">
          {children}
        </main>
        <footer className="sticky bottom-0 border-t border-black/8 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            {showBack ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm font-medium text-black/50 transition-colors hover:text-black"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <div />
            )}
            {!hideNextButton && (
              <button
                onClick={onNext}
                disabled={nextDisabled}
                className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30"
                style={!nextDisabled ? { background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)', boxShadow: '0 12px 24px rgba(94,20,159,0.14)' } : {}}
              >
                {nextLabel}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F4FB] flex flex-col text-black">
      {/* Header — logo only, no step indicator */}
      <header className="border-b border-black/8 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
          <div className="flex items-center gap-3">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
            <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 animate-fade-in">
        {children}
      </main>

      {/* Footer nav */}
      <footer className="border-t border-black/8 bg-white/95 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {showBack ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-black/50 hover:text-black text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}

          {!hideNextButton && (
            <button
              onClick={onNext}
              disabled={nextDisabled}
              className="flex items-center gap-2 disabled:bg-black/10 disabled:text-black/30 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-semibold text-sm transition-colors"
              style={!nextDisabled ? { background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)', boxShadow: '0 12px 24px rgba(94,20,159,0.14)' } : {}}
            >
              {nextLabel}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

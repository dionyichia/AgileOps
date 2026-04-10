import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface StepLayoutProps {
  currentStep: number          // 1–5 (form through recommendation)
  title: string
  subtitle?: string
  children: React.ReactNode
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  showBack?: boolean
  backPath?: string
  hideNextButton?: boolean
  /** No stepper header, no title strip, no footer — for client /toolinput */
  compact?: boolean
  /** When compact: render only title block + children (parent provides chrome, e.g. ClientWorkspaceShell) */
  nested?: boolean
  /** No stepper / title strip; keep footer — use under ClientWorkspaceShell on flat client routes */
  embedded?: boolean
}

const STEPS = [
  'Data Form',
  'Workflow Report',
  'Tool Input',
  'Simulation',
  'Recommendation',
]

export default function StepLayout({
  currentStep,
  title,
  subtitle,
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

  const backPaths = ['/dashboard', '/internal/form', '/internal/workflow-report', '/internal/tool-input', '/simulation']
  const handleBack = () => navigate(backPath ?? backPaths[currentStep - 1] ?? '/dashboard')

  if (compact) {
    if (nested) {
      return (
        <div className="w-full text-black">
          {(title || subtitle) && (
            <div className="mx-auto mb-8 max-w-2xl">
              {title ? (
                <h1 className="text-[36px] font-bold leading-tight tracking-[-0.04em] text-black">{title}</h1>
              ) : null}
              {subtitle ? <p className="mt-1 text-sm text-black/48">{subtitle}</p> : null}
            </div>
          )}
          {children}
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-[#F7F4FB] flex flex-col text-black">
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 animate-fade-in">
          <div className="mb-8 max-w-2xl mx-auto">
            <h1 className="text-[36px] leading-tight font-bold tracking-[-0.04em] text-black">{title}</h1>
            {subtitle && <p className="text-black/48 text-sm mt-1">{subtitle}</p>}
          </div>
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
      {/* Header */}
      <header className="border-b border-black/8 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
            <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const stepNum = i + 1
              const isActive    = stepNum === currentStep
              const isCompleted = stepNum < currentStep
              return (
                <div key={step} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isActive
                          ? 'text-white'
                          : isCompleted
                          ? 'bg-[#F4E8FB] text-[#5E149F]'
                          : 'bg-black/6 text-black/40'
                      }`}
                      style={isActive ? { background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)', boxShadow: '0 10px 24px rgba(94,20,159,0.18)' } : {}}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={`text-xs font-medium hidden sm:block ${
                        isActive ? 'text-[#5E149F]' : isCompleted ? 'text-black/54' : 'text-black/32'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-6 h-px ${isCompleted ? 'bg-[#B4308B]' : 'bg-black/10'}`} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="w-24" />
        </div>
      </header>

      {/* Page title */}
      <div className="border-b border-black/6 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-[36px] leading-tight font-bold tracking-[-0.04em] text-black">{title}</h1>
          {subtitle && <p className="text-black/48 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>

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

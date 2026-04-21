import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useGsapReveal } from '../../hooks/useGsapReveal'

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
  const { projectId } = useParams<{ projectId?: string }>()
  const rootRef = useRef<HTMLDivElement>(null)

  const handleBack = () => navigate(backPath ?? (projectId ? `/projects/${projectId}/dashboard` : '/dashboard'))

  useGsapReveal(rootRef, [compact, nested, embedded], {
    selectors: ['[data-gsap-shell]', '[data-gsap-reveal]'],
    duration: 0.6,
    stagger: 0.09,
    y: 20,
    blur: 12,
  })

  if (compact) {
    if (nested) {
      return (
        <div ref={rootRef} className="w-full text-black">
          {children}
        </div>
      )
    }
    return (
      <div ref={rootRef} className="min-h-screen page-bg flex flex-col text-black">
        <main data-gsap-shell className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    )
  }

  if (embedded) {
    return (
      <div ref={rootRef} className="flex min-h-0 w-full flex-1 flex-col page-bg text-black">
        <main data-gsap-shell className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6">
          {children}
        </main>
        <footer data-gsap-reveal className="sticky bottom-0 border-t border-black/8 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
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
                className="btn-primary"
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
    <div ref={rootRef} className="min-h-screen page-bg flex flex-col text-black">
      {/* Header — logo only, no step indicator */}
      <header data-gsap-reveal className="border-b border-black/8 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 flex items-center">
          <div className="flex items-center gap-3">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-9 w-9 md:h-11 md:w-11 rounded-2xl object-cover"
            />
            <span className="font-bold text-[#111111] text-[22px] md:text-[28px] tracking-[-0.04em]">Axis</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main data-gsap-shell className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>

      {/* Footer nav */}
      <footer data-gsap-reveal className="border-t border-black/8 bg-white/95 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
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
              className="btn-primary"
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

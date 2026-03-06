import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react'

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
}: StepLayoutProps) {
  const navigate = useNavigate()

  const backPaths = ['/', '/form', '/workflow-report', '/tool-input', '/simulation']
  const handleBack = () => navigate(backPath ?? backPaths[currentStep - 1] ?? '/')

  return (
    <div className="min-h-screen bg-[#080C18] flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0B0F1E]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap size={14} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">axis</span>
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
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40'
                          : isCompleted
                          ? 'bg-indigo-900 text-indigo-300'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={`text-xs font-medium hidden sm:block ${
                        isActive ? 'text-indigo-300' : isCompleted ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-6 h-px ${isCompleted ? 'bg-indigo-700' : 'bg-slate-700'}`} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="w-24" />
        </div>
      </header>

      {/* Page title */}
      <div className="border-b border-slate-800/60 bg-[#0B0F1E]">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 animate-fade-in">
        {children}
      </main>

      {/* Footer nav */}
      <footer className="border-t border-slate-800 bg-[#0B0F1E] sticky bottom-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {showBack ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
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
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
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

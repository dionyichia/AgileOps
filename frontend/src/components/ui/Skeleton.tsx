/**
 * Minimal skeleton loading primitives.
 * Uses the project's navy/slate palette with a subtle pulse animation.
 */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-3 bg-slate-800 rounded animate-pulse ${className}`} />
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-800 rounded-xl animate-pulse ${className}`} />
}

export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-3">
      <SkeletonLine className="w-1/3 h-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i % 2 === 0 ? 'w-full' : 'w-2/3'} />
      ))}
    </div>
  )
}

export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#080C18] flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-cerulean border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-xl">!</span>
      </div>
      <p className="text-red-400 text-sm text-center max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-cerulean hover:text-cerulean-300 underline transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  )
}

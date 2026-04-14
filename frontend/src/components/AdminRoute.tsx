import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Status = 'loading' | 'allowed' | 'denied'

/**
 * Wraps any route that requires admin access.
 * - Checks the current Supabase session
 * - Verifies user_profiles.role === 'admin'
 * - Redirects to /login if not authenticated or not admin
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setStatus('denied'); return }

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      setStatus(data?.role === 'admin' ? 'allowed' : 'denied')
    }
    check()
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-black/10"
          style={{ borderTopColor: '#B4308B' }}
        />
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Returns true once we've confirmed the current user has role='admin'.
 * Returns false while loading or if not admin / not authenticated.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      setIsAdmin(data?.role === 'admin')
    }
    check()
  }, [])

  return isAdmin
}

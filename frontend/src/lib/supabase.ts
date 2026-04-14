import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Return the current session's access token (Supabase JWT). */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/** Fetch the caller's role ('admin' | 'client') from user_profiles. */
export async function getUserRole(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return 'client'
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()
  return (data?.role as string) ?? 'client'
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[AgileOps] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Create frontend/.env with your Supabase project credentials.'
  )
}

// Use placeholder values so createClient does not throw on missing env vars.
// Auth calls will fail gracefully rather than crashing the module at load time.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
)

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

/** Clear cached role/project for a user id (call on sign-out). */
export function clearAuthCache(userId: string) {
  localStorage.removeItem(`axis_role_${userId}`)
  localStorage.removeItem(`axis_project_${userId}`)
}

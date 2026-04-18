import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { projects } from '../api/client'
import PublicNavbar from '../components/public/PublicNavbar'
import PublicFooter from '../components/public/PublicFooter'

type Status = 'loading' | 'set-password' | 'error'

export default function AcceptInvite() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('loading')
  const [projectId, setProjectId] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Supabase JS client automatically processes the hash fragment from the
    // invite link and fires onAuthStateChange with event SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const pid = session.user.user_metadata?.project_id as string | undefined
          if (pid) setProjectId(pid)
          setStatus('set-password')
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function handleSetPassword() {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setError(null)
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)

      if (projectId) await projects.claim(projectId)

      navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-black">
      <PublicNavbar />

      <main className="flex-1 px-6 py-10 pt-28 md:px-10 md:py-14 md:pt-32">
        <div
          className="max-w-7xl mx-auto rounded-[34px] bg-white border border-black/6 p-4 md:p-5"
          style={{ boxShadow: '0 26px 70px rgba(15, 23, 42, 0.10), 0 6px 18px rgba(15, 23, 42, 0.05)' }}
        >
          <div className="grid lg:grid-cols-2 gap-0 overflow-hidden rounded-[28px]">

            <section className="px-8 py-10 md:px-16 md:py-16 flex flex-col justify-center min-h-[680px]">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-black/72">
                <span className="h-3 w-3 rounded-sm bg-[#7B4CE2]" />
                Axis
              </div>

              {status === 'loading' && (
                <div className="mt-14">
                  <h1 className="text-[50px] md:text-[64px] leading-[0.98] font-bold tracking-[-0.05em] text-black">
                    One<br />moment…
                  </h1>
                  <p className="mt-5 text-[18px] leading-8 text-black/42">Setting up your workspace.</p>
                  <div className="mt-10 h-1.5 w-48 rounded-full bg-black/6 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-[#B4308B] animate-pulse" />
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="mt-14">
                  <h1 className="text-[50px] md:text-[56px] leading-[0.98] font-bold tracking-[-0.05em] text-black">
                    Invalid link
                  </h1>
                  <p className="mt-5 text-[18px] leading-8 text-black/42">
                    This invite link is invalid or has already been used. Please contact us for a new one.
                  </p>
                  <button
                    onClick={() => navigate('/')}
                    className="mt-10 axis-gradient-button rounded-full px-8 py-4 text-[16px] font-bold"
                  >
                    Back to Home
                  </button>
                </div>
              )}

              {status === 'set-password' && (
                <>
                  <h1 className="mt-14 text-[50px] md:text-[64px] leading-[0.98] font-bold tracking-[-0.05em] text-black">
                    Create<br />Account
                  </h1>
                  <p className="mt-5 text-[18px] leading-8 text-black/42">
                    Set a password to access your Axis workspace.
                  </p>

                  <div className="mt-14 max-w-[420px] space-y-4">
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-14 rounded-[14px] border border-black/10 px-5 text-[16px] outline-none focus:border-[#B4308B]"
                    />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                      className="w-full h-14 rounded-[14px] border border-black/10 px-5 text-[16px] outline-none focus:border-[#B4308B]"
                    />

                    {error && <p className="text-[14px] text-red-500">{error}</p>}

                    <button
                      type="button"
                      onClick={handleSetPassword}
                      disabled={loading || !password || !confirm}
                      className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-[14px] px-8 text-[18px] font-bold text-white axis-gradient-button disabled:opacity-60"
                    >
                      {loading ? 'Creating account…' : 'Create Account'}
                    </button>

                    <p className="pt-4 text-[13px] text-black/38 text-center">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="font-semibold text-[#7B4CE2] transition-opacity hover:opacity-70"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className="p-3 md:p-4">
              <div
                className="h-full min-h-[680px] rounded-[28px]"
                style={{
                  background: 'linear-gradient(160deg, #5E149F 0%, #B4308B 50%, #F75A8C 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              />
            </section>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

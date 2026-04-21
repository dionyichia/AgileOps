import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, getUserRole } from '../lib/supabase'
import { projects } from '../api/client'
import PublicNavbar from '../components/public/PublicNavbar'
import PublicFooter from '../components/public/PublicFooter'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw new Error(authError.message)
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) throw new Error(authError.message)
      }

      const role = await getUserRole()
      if (role === 'admin') {
        navigate('/internal')
        return
      }

      const userProjects = await projects.list()
      if (userProjects.length > 0) {
        navigate(`/projects/${userProjects[0].id}/dashboard`)
      } else {
        navigate('/get-started')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!resetEmail.trim()) return
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail)
    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
      setTimeout(() => {
        setShowForgotModal(false)
        setResetSent(false)
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-black">
      <PublicNavbar />

      <main className="flex-1 px-4 py-10 pt-24 md:px-10 md:py-14 md:pt-32">
        <div
          className="max-w-7xl mx-auto rounded-[24px] md:rounded-[34px] border border-white/8 p-3 md:p-5"
          style={{ background: 'var(--surface-card)', boxShadow: '0 26px 70px rgba(0, 0, 0, 0.40)' }}
        >
          <div className="grid lg:grid-cols-2 gap-0 overflow-hidden rounded-[20px] md:rounded-[28px]">
            <section className="px-6 py-10 md:px-16 md:py-16 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-white/72">
                <span className="h-3 w-3 rounded-sm bg-axispurple-900" />
                Axis
              </div>

              <h1 className="mt-8 md:mt-14 text-[38px] md:text-[50px] lg:text-[64px] leading-[0.98] font-bold tracking-[-0.05em] text-white">
                {mode === 'login' ? <>Hello,<br />Welcome Back</> : <>Create<br />Account</>}
              </h1>

              <p className="mt-4 md:mt-5 text-[16px] md:text-[18px] leading-7 md:leading-8 text-white/48">
                Access your workflow analysis and tool recommendations.
              </p>

              <div className="mt-8 md:mt-14 max-w-[420px] space-y-4">
                {notice && (
                  <div className="rounded-[14px] border border-axispurple-900/40 bg-axispurple-900/10 px-4 py-3 text-[14px] text-white/80">
                    {notice}
                  </div>
                )}
                <input
                  type="email"
                  placeholder="stanley@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base h-14 rounded-[14px] px-5 text-[16px] focus-ring-accent placeholder:text-white/30"
                />
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="input-base h-14 rounded-[14px] px-5 text-[16px] focus-ring-accent placeholder:text-white/30"
                />

                {error && <p className="text-[14px] text-red-500">{error}</p>}
                {mode === 'login' && (
                  <div className="flex items-center justify-between pt-1 text-[14px] text-white/48">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded accent-axispurple-900" />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail('')
                        setResetSent(false)
                        setShowForgotModal(true)
                      }}
                      className="font-medium text-white/48 transition-colors hover:text-axispurple-900"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-[14px] px-8 text-[18px] font-bold text-white axis-gradient-button disabled:opacity-60"
                >
                  {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>

                <p className="pt-16 text-[14px] text-white/42">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === 'login') {
                        navigate('/get-started')
                      } else {
                        setMode('login')
                        setError(null)
                      }
                    }}
                    className="font-semibold text-axispurple-900 transition-opacity hover:opacity-70"
                  >
                    {mode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </section>

            <section className="hidden lg:block p-3 md:p-4">
              <div
                className="h-full min-h-[680px] rounded-[28px]"
                style={{ background: 'var(--surface-page)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
              />
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />

      {showForgotModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setShowForgotModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            className="w-full max-w-md rounded-[28px] border border-white/8 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.60)] md:p-10"
            style={{ background: 'var(--surface-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="forgot-password-title" className="text-center text-[26px] font-bold leading-tight text-white md:text-[30px]">
              Reset your password
            </h2>
            {resetSent ? (
              <p className="mt-6 text-center text-[16px] leading-7 text-sea-500 font-medium">
                Check your inbox — a reset link is on its way.
              </p>
            ) : (
              <>
                <p className="mt-5 text-center text-[16px] leading-7 text-white/60">
                  Enter your work email and we&apos;ll send you a secure link to reset your password.
                </p>
                <label htmlFor="reset-email" className="sr-only">Work email</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Work email"
                  className="input-base mt-6 rounded-[14px] px-5 py-4 text-[16px] focus-ring-accent placeholder:text-white/30"
                />
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="order-2 rounded-full border border-white/15 px-6 py-3 text-[15px] font-semibold text-white/80 transition-colors hover:bg-white/[0.05] sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="order-1 axis-gradient-button rounded-full px-8 py-3 text-[15px] font-bold text-white sm:order-2"
                  >
                    Send reset link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

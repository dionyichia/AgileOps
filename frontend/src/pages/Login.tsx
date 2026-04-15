import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getUserRole } from '../lib/supabase'
import { projects } from '../api/client'

export default function Login() {
  const navigate = useNavigate()
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
        navigate('/dashboard')
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
    <div className="min-h-screen bg-[#F8F7FB] text-black flex flex-col">
      <header className="border-b border-black/5 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center">
            <img
              src="/axis-logo.png"
              alt="Axis logo"
              className="h-11 w-11 rounded-2xl object-cover"
            />
          </button>

          <div className="ml-auto flex items-center justify-end gap-4 md:gap-8">
            <button onClick={() => navigate('/#why-axis')} className="hidden md:inline text-[16px] font-medium transition-opacity hover:opacity-70">
              Why Axis?
            </button>
            <button onClick={() => navigate('/#how-it-works')} className="hidden md:inline text-[16px] font-medium transition-opacity hover:opacity-70">
              How it Works
            </button>
            <button
              onClick={() => navigate('/get-started')}
              className="axis-gradient-button rounded-full px-6 py-3 text-[16px] font-bold"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-10 py-10 md:py-14">
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

              <h1 className="mt-14 text-[50px] md:text-[64px] leading-[0.98] font-bold tracking-[-0.05em] text-black">
                {mode === 'login' ? <>Hello,<br />Welcome Back</> : <>Create<br />Account</>}
              </h1>

              <p className="mt-5 text-[18px] leading-8 text-black/42">
                Access your workflow analysis and tool recommendations.
              </p>

              <div className="mt-14 max-w-[420px] space-y-4">
                <input
                  type="email"
                  placeholder="stanley@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 rounded-[14px] border border-black/10 px-5 text-[16px] outline-none focus:border-[#B4308B]"
                />
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-14 rounded-[14px] border border-black/10 px-5 text-[16px] outline-none focus:border-[#B4308B]"
                />

                {error && <p className="text-[14px] text-red-500">{error}</p>}
                {mode === 'login' && (
                  <div className="flex items-center justify-between pt-1 text-[14px] text-black/48">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded accent-[#7B4CE2]" />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail('')
                        setResetSent(false)
                        setShowForgotModal(true)
                      }}
                      className="font-medium text-black/48 transition-colors hover:text-[#5E149F]"
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

                <p className="pt-16 text-[14px] text-black/42">
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
                    className="font-semibold text-[#7B4CE2] transition-opacity hover:opacity-70"
                  >
                    {mode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </section>

            <section className="p-3 md:p-4">
              <div
                className="h-full min-h-[680px] rounded-[28px] bg-[#D9D9D9]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}
              />
            </section>
          </div>
        </div>
      </main>

      <footer
        className="mt-10 px-6 md:px-10 pt-14 pb-8 text-white"
        style={{ background: 'linear-gradient(180deg, #5E149F 0%, #B4308B 48%, #F75A8C 100%)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1.6fr_0.9fr]">
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <img src="/axis-logo.png" alt="Axis logo" className="h-11 w-11 rounded-2xl object-cover" />
                <span className="text-[22px] font-bold">Axis</span>
              </div>
              <p className="mt-5 text-[14px] leading-7 text-white/78">
                We help revenue teams evaluate and select the right tools by analyzing real workflows and delivering data-backed recommendations.
              </p>
            </div>

            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Product', items: ['How It Works', 'Workflow Analysis', 'Tool Evaluation', 'Recommendations', 'Sample Report'] },
                { title: 'Company', items: ['About', 'Why Axis', 'Contact'] },
                { title: 'Resources', items: ['FAQs', 'Case Studies', 'Documentation'] },
                { title: 'Legal', items: ['Privacy Policy', 'Terms of Service', 'Security'] },
              ].map((group) => (
                <div key={group.title}>
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/68">{group.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <li key={item} className="text-[14px] text-white/82">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/18 bg-white/10 px-6 py-6 backdrop-blur-sm">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/68">Get Started</p>
              <h3 className="mt-4 text-[24px] leading-tight font-bold">Make your next tool decision with confidence.</h3>
              <button
                onClick={() => navigate('/get-started')}
                className="mt-6 rounded-full bg-white px-6 py-3 text-[15px] font-bold text-black transition-transform hover:-translate-y-0.5"
              >
                Get My Recommendation
              </button>
            </div>
          </div>

          <div className="mt-12 border-t border-white/18 pt-6 text-[13px] text-white/64">
            © 2026 Axis. All rights reserved.
          </div>
        </div>
      </footer>

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
            className="w-full max-w-md rounded-[28px] border border-black/8 bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="forgot-password-title" className="text-center text-[26px] font-bold leading-tight text-black md:text-[30px]">
              Reset your password
            </h2>
            {resetSent ? (
              <p className="mt-6 text-center text-[16px] leading-7 text-[#32936F] font-medium">
                Check your inbox — a reset link is on its way.
              </p>
            ) : (
              <>
                <p className="mt-5 text-center text-[16px] leading-7 text-black/72">
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
                  className="mt-6 w-full rounded-[14px] border border-black/10 px-5 py-4 text-[16px] outline-none focus:border-[#B4308B]"
                />
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="order-2 rounded-full border border-black/15 px-6 py-3 text-[15px] font-semibold text-black/80 transition-colors hover:bg-black/[0.03] sm:order-1"
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

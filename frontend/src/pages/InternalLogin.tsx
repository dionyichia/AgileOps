import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function InternalLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error(authError.message)

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        await supabase.auth.signOut()
        throw new Error(`Could not load profile: ${profileError.message}`)
      }

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error(
          `Access denied — your account role is "${profile?.role ?? 'unknown'}". Admin access required.`
        )
      }

      navigate('/internal')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4FB] text-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3">
          <img src="/axis-logo.png" alt="Axis logo" className="h-11 w-11 rounded-2xl object-cover" />
          <span className="font-bold text-[#111111] text-[28px] tracking-[-0.04em]">Axis</span>
          <span className="text-xs font-medium text-[#5E149F] bg-[#F4E8FB] px-2.5 py-1 rounded-full">INTERNAL</span>
        </div>
        <h2 className="mt-6 text-center text-[28px] font-bold tracking-[-0.02em] text-gray-900">
          Staff Portal
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] rounded-[24px] border border-black/8 sm:px-10">
          <div className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Work Email
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@axis.io"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 rounded-[14px] border border-black/10 px-5 text-[15px] outline-none focus:border-[#B4308B] transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-12 rounded-[14px] border border-black/10 px-5 text-[15px] outline-none focus:border-[#B4308B] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-[14px] text-red-500 font-medium bg-red-500/10 p-3 rounded-[12px]">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 rounded-[14px] shadow-sm text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)' }}
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

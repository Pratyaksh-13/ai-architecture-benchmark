import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signup } from '../api/client'
import PageTransition from '../components/PageTransition'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupComplete, setSignupComplete] = useState(false)

  const handleSubmit = async () => {
    if (!email) {
      setError('email is required')
      return
    }
    if (password.length < 8) {
      setError('password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signup(email, password)
      setSignupComplete(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center bg-blueprint-grid p-4 text-ink font-sans">
        <div className="bg-paper border border-hairline p-8 w-full max-w-sm rounded-sm">
          {/* Logo / Header Block */}
          <div className="text-center mb-6">
            <div className="w-10 h-10 border border-blueprint flex items-center justify-center mx-auto text-blueprint font-mono text-lg font-bold mb-3">
              ⬡
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight mb-1">Sign Up</h1>
            <p className="text-graphite font-mono text-[9px] uppercase tracking-wider">Create Spec Sheet Account</p>
          </div>

          {signupComplete ? (
            <div className="text-center py-4 font-mono">
              <p className="text-blueprint font-bold text-sm mb-3">✓ ACCOUNT CREATED</p>
              <p className="text-graphite text-xs leading-relaxed">
                Verification link dispatched. Please check your email inbox and verify your account to activate login privileges.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono font-bold tracking-wider uppercase text-graphite mb-1.5">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  placeholder="engineer@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-paper border border-hairline rounded-sm px-4 py-2.5 font-mono text-xs text-ink placeholder-graphite/40 focus:outline-none focus:border-blueprint transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold tracking-wider uppercase text-graphite mb-1.5">
                  PASSWORD (8+ CHARACTERS)
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-paper border border-hairline rounded-sm px-4 py-2.5 font-mono text-xs text-ink placeholder-graphite/40 focus:outline-none focus:border-blueprint transition-colors"
                />
              </div>

              {error && (
                <div className="border border-annotation text-annotation bg-annotation/5 p-3 rounded-sm text-xs font-mono">
                  [ ERROR ]: {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blueprint hover:bg-[#1E3D7D] disabled:opacity-50 text-paper font-mono uppercase tracking-wider text-xs font-bold py-3 rounded-sm transition-colors duration-100"
              >
                {loading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
              </button>
            </div>
          )}

          <p className="text-graphite font-mono text-xs mt-6 text-center">
            already have an account?{' '}
            <Link to="/login" className="text-blueprint font-bold hover:underline">
              [ LOG IN ]
            </Link>
          </p>
        </div>
      </div>
    </PageTransition>
  )
}
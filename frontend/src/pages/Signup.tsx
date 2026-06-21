import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signup } from '../api/client'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupComplete, setSignupComplete] = useState(false)

  const handleSubmit = async () => {
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
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-medium text-slate-100 mb-6">sign up</h1>

        {signupComplete ? (
          <div className="text-center">
            <p className="text-teal-400 text-sm mb-2">✓ account created</p>
            <p className="text-slate-400 text-sm">check your email for a verification link before logging in.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-purple"
            />
            <input
              type="password"
              placeholder="password (8+ characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-purple"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-accent-purple hover:bg-purple-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'creating account...' : 'sign up'}
            </button>
          </div>
        )}

        <p className="text-slate-500 text-sm mt-5 text-center">
          already have an account? <Link to="/login" className="text-accent-purple_light">log in</Link>
        </p>
      </div>
    </div>
  )
}
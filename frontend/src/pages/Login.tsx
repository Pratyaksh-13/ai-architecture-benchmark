import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-medium text-slate-100 mb-6">log in</h1>

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
            placeholder="password"
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
            {loading ? 'logging in...' : 'log in'}
          </button>
        </div>

        <p className="text-slate-500 text-sm mt-5 text-center">
          no account? <Link to="/signup" className="text-accent-purple_light">sign up</Link>
        </p>
      </div>
    </div>
  )
}
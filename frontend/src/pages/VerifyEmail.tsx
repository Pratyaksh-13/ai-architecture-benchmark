import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmail } from '../api/client'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(e => {
        setStatus('error')
        setMessage(e?.response?.data?.detail ?? 'Verification failed')
      })
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 w-full max-w-sm text-center">
        {status === 'loading' && <p className="text-slate-400 text-sm">verifying...</p>}
        {status === 'success' && (
          <>
            <p className="text-teal-400 text-sm mb-4">✓ email verified successfully</p>
            <Link to="/login" className="text-accent-purple_light text-sm underline">log in →</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 text-sm mb-4">{message}</p>
            <Link to="/login" className="text-accent-purple_light text-sm underline">back to login</Link>
          </>
        )}
      </div>
    </div>
  )
}
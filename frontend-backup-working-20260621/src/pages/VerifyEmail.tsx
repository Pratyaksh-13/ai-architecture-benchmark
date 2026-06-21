import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmail } from '../api/client'
import PageTransition from '../components/PageTransition'

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
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center bg-blueprint-grid p-4 text-ink font-sans">
        <div className="bg-paper border border-hairline p-8 w-full max-w-sm text-center rounded-sm font-mono">
          <div className="w-10 h-10 border border-blueprint flex items-center justify-center mx-auto text-blueprint text-lg font-bold mb-4">
            ⬡
          </div>

          {status === 'loading' && (
            <p className="text-graphite text-xs uppercase tracking-widest animate-pulse">
              VERIFYING CREDENTIALS...
            </p>
          )}

          {status === 'success' && (
            <>
              <p className="text-blueprint font-bold text-sm mb-4">✓ EMAIL VERIFIED SUCCESSFULLY</p>
              <Link to="/login" className="inline-block text-blueprint font-bold hover:underline text-xs">
                [ LOG IN → ]
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="border border-annotation text-annotation bg-annotation/5 p-3 rounded-sm text-xs mb-4">
                [ VERIFICATION FAILED ]: {message}
              </div>
              <Link to="/login" className="inline-block text-graphite hover:text-ink text-xs font-bold">
                [ BACK TO LOGIN ]
              </Link>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createProject, generateArchitectures } from '../api/client'

const STEPS = [
  { label: 'Sending requirement to LLM', duration: 3000 },
  { label: 'Generating Monolithic architecture', duration: 4000 },
  { label: 'Generating Microservices architecture', duration: 5000 },
  { label: 'Generating Event-Driven architecture', duration: 5000 },
  { label: 'Finalizing diagrams and tradeoffs', duration: 99999 },
]

function GenerationProgress() {
  const [currentStep, setCurrentStep] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const advance = (step: number) => {
      if (step >= STEPS.length - 1) return
      timerRef.current = setTimeout(() => {
        setCurrentStep(step + 1)
        advance(step + 1)
      }, STEPS[step].duration)
    }
    advance(0)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className="mt-5 space-y-2.5 animate-fade-in">
      {STEPS.map((step, i) => {
        const isDone = i < currentStep
        const isCurrent = i === currentStep
        return (
          <div key={i} className="flex items-center gap-3">
            {/* Status icon */}
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              {isDone ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="animate-fade-in">
                  <circle cx="8" cy="8" r="7" fill="#042f2e" stroke="#14b8a6" strokeWidth="1.5"/>
                  <path d="M5 8l2 2 4-4" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : isCurrent ? (
                <div className="w-4 h-4 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-dark-600" />
              )}
            </div>
            {/* Label */}
            <span className={`text-sm transition-colors duration-300 ${
              isDone ? 'text-slate-500 line-through decoration-dark-600' :
              isCurrent ? 'text-slate-200 font-medium' :
              'text-slate-700'
            }`}>
              {step.label}
              {isCurrent && <span className="text-slate-600 ml-1 text-xs">...</span>}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-slate-600 mt-3 pl-8">
        This takes 10–20 seconds. The LLM is generating 3 full architecture proposals with Mermaid diagrams.
      </p>
    </div>
  )
}

const PROVIDER = 'openai'

export default function NewProject() {
  const [requirement, setRequirement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (requirement.trim().length < 10) {
      setError('Requirement must be at least 10 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const project = await createProject(requirement)
      await generateArchitectures(project.id, PROVIDER)
      navigate(`/projects/${project.id}`)
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? 'Something went wrong'
      const status = e?.response?.status
      if (status === 502 || status === 503) {
        setError('The LLM returned an unexpected response. Please try again.')
      } else {
        setError(detail)
      }
      setLoading(false)
    }
  }

  const charCount = requirement.length

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-6">
        <Link to="/" className="hover:text-slate-400 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-400">New Project</span>
      </div>

      <h1 className="text-2xl font-semibold text-slate-100 tracking-tight mb-1">New Project</h1>
      <p className="text-slate-500 text-sm mb-8">Describe your software requirement and let the AI generate architecture proposals.</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-5">
            {/* Requirement textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold tracking-widest uppercase text-slate-500">
                  Requirement
                </label>
                <span className={`text-xs tabular-nums ${charCount < 10 ? 'text-slate-700' : 'text-slate-500'}`}>
                  {charCount} chars
                </span>
              </div>
              <textarea
                rows={5}
                value={requirement}
                onChange={e => setRequirement(e.target.value)}
                disabled={loading}
                placeholder="e.g. Build a scalable URL shortener that handles 10k requests per second with 99.9% uptime"
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-accent-purple transition-colors resize-none disabled:opacity-50"
              />
            </div>

            {/* Provider badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-widest uppercase text-slate-600">LLM Provider</span>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-accent-purple/15 border border-accent-purple/30 text-accent-purple_light">
                OpenRouter
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3 animate-fade-in">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
                  <path d="M8 5v4" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.5" fill="#f87171" stroke="#f87171"/>
                </svg>
                <div>
                  <p className="text-red-400 text-sm">{error}</p>
                  <button onClick={handleSubmit} className="text-xs text-red-500 hover:text-red-300 mt-1 underline">
                    Try again →
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || requirement.trim().length < 10}
              className="w-full flex items-center justify-center gap-2 bg-accent-purple hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-3 rounded-lg transition-all duration-150 hover:shadow-lg hover:shadow-accent-purple/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating architectures...
                </>
              ) : (
                <>
                  Generate Architectures
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>

            {/* Generation progress */}
            {loading && <GenerationProgress />}
          </div>
        </div>

        {/* Info panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-500 mb-4">What happens next</p>
            <div className="space-y-4">
              {[
                {
                  step: '01',
                  title: '3 Architecture Proposals',
                  desc: 'Monolithic, Microservices, and Event-Driven — each tailored to your requirement.',
                  color: 'text-teal-400',
                },
                {
                  step: '02',
                  title: 'Mermaid Diagrams',
                  desc: 'Visual flowcharts for each architecture, rendered live in the browser.',
                  color: 'text-accent-purple_light',
                },
                {
                  step: '03',
                  title: 'Benchmark Simulation',
                  desc: 'Run latency, throughput, and resource usage simulations across all 3.',
                  color: 'text-amber-400',
                },
                {
                  step: '04',
                  title: 'AI Recommendation',
                  desc: 'Get a confidence-scored recommendation with reasoning from the LLM.',
                  color: 'text-rose-400',
                },
              ].map(({ step, title, desc, color }) => (
                <div key={step} className="flex gap-3">
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${color} mt-0.5`}>{step}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-300">{title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="text-slate-500 font-medium">⚡ Tip:</span> Be specific about your scale requirements, expected traffic, team size, and deployment preferences for more accurate architecture proposals.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createProject, generateArchitectures } from '../api/client'
import PageTransition from '../components/PageTransition'

const STEPS = [
  { label: 'Drafting Monolithic architecture...', duration: 4000 },
  { label: 'Drafting Microservices architecture...', duration: 5500 },
  { label: 'Drafting Event-Driven architecture...', duration: 5500 },
  { label: 'Assembling blueprint spec sheet...', duration: 99999 },
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

  const progressPercent = Math.min(Math.round(((currentStep) / STEPS.length) * 100) + 15, 95)

  return (
    <div className="mt-6 space-y-4 border border-hairline p-5 bg-paper/50 rounded-sm font-mono text-xs text-left">
      <div className="flex justify-between items-center text-graphite mb-1 font-bold">
        <span>STATUS: SYSTEM DRAFTING IN PROGRESS</span>
        <span className="tabular-nums">{progressPercent}%</span>
      </div>
      
      {/* Technical progress line */}
      <div className="w-full h-[2px] bg-hairline/30 overflow-hidden relative">
        <div 
          className="h-full bg-blueprint transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-1.5 pt-2">
        <div className="text-blueprint font-bold animate-pulse">
          &gt; {STEPS[currentStep].label}
        </div>
        <p className="text-graphite text-[10px] uppercase tracking-wide leading-relaxed">
          The LLM is constructing architectures, rendering Mermaid flowcharts, and compile tradeoffs...
        </p>
      </div>
    </div>
  )
}

export default function NewProject() {
  const [requirement, setRequirement] = useState('')
  const [provider, setProvider] = useState<'claude' | 'openai'>('openai')
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
      await generateArchitectures(project.id, provider)
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
    <PageTransition>
      <div className="max-w-5xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-graphite mb-6 uppercase tracking-wider">
          <Link to="/" className="hover:text-blueprint transition-colors duration-100">[ DASHBOARD ]</Link>
          <span>/</span>
          <span className="text-ink">NEW SPECIFICATION</span>
        </div>

        <div className="mb-8 pb-5 border-b border-hairline">
          <h1 className="text-3xl font-serif font-bold text-ink tracking-tight">New Comparison Specification</h1>
          <p className="text-graphite font-mono text-[10px] tracking-wider uppercase mt-1">
            PROVIDE REQUIREMENT DETAILS TO TRIGGER SIMULTANEOUS ARCHITECTURE GENERATIONS
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="bg-paper border border-hairline rounded-sm p-6 space-y-6">
              {/* Requirement textarea */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-mono font-bold tracking-widest uppercase text-graphite">
                    SYSTEM REQUIREMENT DESCRIPTION
                  </label>
                  <span className={`text-[10px] font-mono tabular-nums ${charCount < 10 ? 'text-annotation font-bold' : 'text-graphite'}`}>
                    {charCount} CHARS
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={requirement}
                  onChange={e => setRequirement(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Build a scalable URL shortener that handles 10k requests per second with 99.9% uptime"
                  className="w-full bg-transparent border border-hairline rounded-sm px-4 py-3 font-mono text-xs text-ink placeholder-graphite/40 focus:outline-none focus:border-blueprint resize-none disabled:opacity-50"
                />
              </div>

              {/* Provider selection */}
              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest uppercase text-graphite mb-2.5">
                  LLM GENERATION ENGINE
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setProvider('openai')}
                    className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider rounded-sm border transition-colors duration-100 ${
                      provider === 'openai'
                        ? 'border-blueprint text-blueprint bg-blueprint/5 font-bold'
                        : 'border-hairline text-graphite hover:text-ink hover:border-graphite'
                    }`}
                  >
                    OpenAI / OpenRouter
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setProvider('claude')}
                    className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider rounded-sm border transition-colors duration-100 ${
                      provider === 'claude'
                        ? 'border-blueprint text-blueprint bg-blueprint/5 font-bold'
                        : 'border-hairline text-graphite hover:text-ink hover:border-graphite'
                    }`}
                  >
                    Anthropic Claude
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 border border-annotation text-annotation bg-annotation/5 px-4 py-3 rounded-sm font-mono text-xs">
                  <span className="flex-shrink-0 mt-0.5 font-bold">[ ERROR ]:</span>
                  <div className="flex-1">
                    <p>{error}</p>
                    <button onClick={handleSubmit} className="text-annotation underline font-bold mt-1.5 block">
                      RE-SUBMIT SPECIFICATION →
                    </button>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || requirement.trim().length < 10}
                className="w-full flex items-center justify-center gap-2 bg-blueprint hover:bg-[#1E3D7D] disabled:opacity-40 disabled:cursor-not-allowed text-paper font-mono uppercase tracking-wider text-xs font-bold py-3.5 rounded-sm transition-colors duration-100"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    DRAFTING ARCHITECTURAL SCHEMATICS...
                  </>
                ) : (
                  <>
                    DRAFT ARCHITECTURES
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </>
                )}
              </button>

              {/* Generation progress */}
              {loading && <GenerationProgress />}
            </div>
          </div>

          {/* Info panel */}
          <div className="lg:col-span-2 space-y-4 text-left font-mono">
            <div className="bg-paper border border-hairline rounded-sm p-5">
              <p className="text-[10px] font-bold tracking-widest uppercase text-graphite mb-4">SPEC DRAFTING PIPELINE</p>
              <div className="space-y-4">
                {[
                  {
                    step: '01',
                    title: '3 SPEC SCHEMATICS',
                    desc: 'Generates monolithic, microservices, and event-driven options tailored directly to constraints.',
                  },
                  {
                    step: '02',
                    title: 'VECTOR FLOWCHARTS',
                    desc: 'Mermaid code compilation renders interactive system diagrams live on paper grid.',
                  },
                  {
                    step: '03',
                    title: 'SIMULATED BENCHMARKS',
                    desc: 'Simulate CPU, memory, error rate, latency and throughput stats across all versions.',
                  },
                  {
                    step: '04',
                    title: 'AI REVIEW STAMP',
                    desc: 'LLM analysis stamps recommended blueprint and renders detailed trade-offs ledger.',
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3 text-xs">
                    <span className="font-bold tabular-nums text-blueprint mt-0.5">{step}</span>
                    <div>
                      <p className="font-bold text-ink">{title}</p>
                      <p className="text-graphite text-[10px] mt-0.5 leading-relaxed uppercase">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-paper border border-hairline rounded-sm p-4 text-[10px] text-graphite leading-relaxed uppercase">
              <span className="text-blueprint font-bold">💡 BLUEPRINT TIP:</span> Define target request loads (RPS), database sizes, consistency requirements, and latency caps for precise structural calculations.
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProject, getArchitectures, runBenchmark, getBenchmarks, generateRecommendation, getRecommendation } from '../api/client'
import ArchitectureCard from '../components/ArchitectureCard'
import BenchmarkCharts from '../components/BenchmarkCharts'
import StatusBadge from '../components/StatusBadge'
import { SkeletonCard } from '../components/SkeletonCard'
import type { Project, Architecture, Benchmark, Recommendation } from '../types'
import PageTransition from '../components/PageTransition'

function RecommendationBanner({ rec }: { rec: Recommendation }) {
  const confidence = Math.round(rec.confidence_score * 100)
  const archLabel = rec.recommended_arch_type.replace('_', ' ').toUpperCase()

  return (
    <div className="border-2 border-annotation bg-annotation/5 p-6 mb-8 rounded-sm font-mono text-left relative overflow-hidden">
      {/* Decorative Red Reviewer Mark */}
      <div className="absolute top-0 right-0 border-l border-b border-annotation px-2 py-0.5 text-[9px] font-bold text-annotation uppercase">
        REVIEWER COMMENTARY
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-annotation/30">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-annotation block mb-1">
            AI RECOMMENDATION VERDICT
          </span>
          <h2 className="font-serif text-xl font-bold text-ink italic">
            Fit Winner: <span className="text-annotation underline decoration-dashed">{archLabel}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-graphite font-bold uppercase">CONFIDENCE LEVEL</span>
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-2 border border-annotation bg-transparent rounded-none overflow-hidden relative">
              <div 
                className="h-full bg-annotation transition-all duration-700" 
                style={{ width: `${confidence}%` }} 
              />
            </div>
            <span className="text-xs font-bold text-annotation tabular-nums">{confidence}%</span>
          </div>
        </div>
      </div>

      <p className="text-ink text-xs uppercase leading-relaxed font-semibold">
        &gt; {rec.reasoning}
      </p>
      
      <div className="text-[9px] text-graphite uppercase mt-4 flex justify-between">
        <span>VERDICT GENERATION: {rec.llm_provider}</span>
        <span>CONFIRMED: {new Date(rec.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [architectures, setArchitectures] = useState<Architecture[]>([])
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [benchmarking, setBenchmarking] = useState(false)
  const [loadProfile, setLoadProfile] = useState('medium')
  const [recommending, setRecommending] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState('')
  const [recommendError, setRecommendError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      getProject(Number(id)),
      getArchitectures(Number(id)),
      getBenchmarks(Number(id)),
      getRecommendation(Number(id)),
    ]).then(([p, a, b, r]) => {
      setProject(p)
      setArchitectures(a.architectures)
      setBenchmarks(b.benchmarks)
      setRecommendation(r)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const handleBenchmark = async () => {
    if (!id) return
    setBenchmarking(true)
    setBenchmarkError('')
    try {
      const result = await runBenchmark(Number(id), loadProfile)
      setBenchmarks(result.benchmarks)
    } catch {
      setBenchmarkError('Benchmark failed. Please try again.')
    } finally {
      setBenchmarking(false)
    }
  }

  const handleRecommend = async () => {
    if (!id) return
    setRecommending(true)
    setRecommendError('')
    try {
      const result = await generateRecommendation(Number(id))
      setRecommendation(result)
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 502 || status === 503) {
        setRecommendError('The LLM returned an unexpected response. Please try again.')
      } else {
        setRecommendError('Failed to generate recommendation. Please try again.')
      }
    } finally {
      setRecommending(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 w-48 bg-hairline/40 rounded-sm skeleton mb-6" />
        <div className="h-7 w-2/3 bg-hairline/40 rounded-sm skeleton mb-3" />
        <div className="h-5 w-20 bg-hairline/40 rounded-sm skeleton mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-mono">
        <p className="text-graphite text-xs mb-3 uppercase">[ ERROR: RECORD NOT FOUND ]</p>
        <Link to="/" className="text-blueprint text-xs font-bold hover:underline">← RETURN TO DASHBOARD</Link>
      </div>
    )
  }

  const hasBenchmarks = benchmarks.length > 0
  const hasRecommendation = recommendation !== null

  return (
    <PageTransition>
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-graphite mb-5 uppercase tracking-wider">
          <Link to="/" className="hover:text-blueprint transition-colors duration-100">[ DASHBOARD ]</Link>
          <span>/</span>
          <span className="text-ink">SPECIFICATION ENTRY #{project.id}</span>
        </div>

        {/* Header */}
        <div className="mb-6 pb-5 border-b border-hairline">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-2xl font-serif font-bold text-ink leading-snug max-w-3xl">
              {project.requirement}
            </h1>
            <StatusBadge status={project.status} size="md" />
          </div>
          <p className="text-graphite font-mono text-[9px] uppercase tracking-wide">
            RECORDED {new Date(project.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
            {project.updated_at && ` · UPDATED ${new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </p>
        </div>

        {/* Technical Action Controls */}
        <div className="flex items-center gap-3 flex-wrap mb-8 pb-6 border-b border-hairline font-mono">
          <div className="flex items-center border border-hairline rounded-sm bg-transparent px-2.5 py-1.5 mr-2">
            <span className="text-[9px] font-bold text-graphite uppercase mr-2 select-none">LOAD PROFILE:</span>
            <select
              value={loadProfile}
              onChange={e => setLoadProfile(e.target.value)}
              className="text-xs bg-transparent text-ink font-bold focus:outline-none cursor-pointer uppercase"
            >
              <option value="light" className="bg-paper text-ink">LIGHT</option>
              <option value="medium" className="bg-paper text-ink">MEDIUM</option>
              <option value="heavy" className="bg-paper text-ink">HEAVY</option>
            </select>
          </div>

          <button
            onClick={handleBenchmark}
            disabled={benchmarking || architectures.length === 0}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm border bg-transparent border-hairline text-graphite hover:text-ink hover:border-blueprint transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {benchmarking ? (
              <>
                <div className="w-3 h-3 border border-graphite/40 border-t-graphite rounded-full animate-spin" />
                SIMULATING...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4v4l3 3" />
                </svg>
                {hasBenchmarks ? 'RE-RUN SIMULATION' : 'RUN BENCHMARK'}
              </>
            )}
          </button>

          {/* AI Recommendation — Requires Benchmarks */}
          <div className="relative group">
            <button
              onClick={handleRecommend}
              disabled={recommending || !hasBenchmarks}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm border bg-transparent border-hairline text-annotation hover:text-annotation hover:border-annotation hover:bg-annotation/5 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {recommending ? (
                <>
                  <div className="w-3 h-3 border border-annotation/40 border-t-annotation rounded-full animate-spin" />
                  ANALYZING SPEC...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M8 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" />
                  </svg>
                  {hasRecommendation ? 'RE-ANALYZE' : 'GET RECOMMENDATION'}
                </>
              )}
            </button>
            {!hasBenchmarks && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-paper border border-hairline text-[9px] text-annotation font-bold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 rounded-sm">
                RUN BENCHMARK FIRST
              </div>
            )}
          </div>

          {/* Simulation status timestamp */}
          {hasBenchmarks && (
            <span className="text-[10px] text-graphite uppercase tracking-wide ml-auto">
              SIMULATED: {new Date(benchmarks[0].created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* Technical Errors block */}
          {benchmarkError && (
            <span className="text-xs text-annotation font-bold flex items-center gap-1">
              ⚠ [ERROR]: {benchmarkError}
            </span>
          )}
          {recommendError && (
            <span className="text-xs text-annotation font-bold flex items-center gap-1">
              ⚠ [ERROR]: {recommendError}
            </span>
          )}
        </div>

        {/* AI Stamp Banner */}
        {recommendation && (
          <RecommendationBanner rec={recommendation} />
        )}

        {/* Architecture proposals */}
        {architectures.length > 0 ? (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <p className="text-[10px] font-mono font-semibold tracking-widest uppercase text-graphite">SPECIFICATION BLUEPRINTS</p>
              <div className="flex-1 h-px bg-hairline" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {architectures.map(a => (
                <ArchitectureCard
                  key={a.id}
                  arch={a}
                  isRecommended={recommendation?.recommended_arch_type === a.arch_type}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-paper border border-hairline border-dashed rounded-sm p-8 text-center mb-10 font-mono">
            <p className="text-graphite text-xs uppercase">[ ARCHITECTURE SCHEMATICS ABSENT ]</p>
          </div>
        )}

        {/* Spec Comparison Sheet section */}
        {hasBenchmarks && (
          <div className="border-t border-hairline pt-6">
            <BenchmarkCharts architectures={architectures} benchmarks={benchmarks} />
          </div>
        )}
      </div>
    </PageTransition>
  )
}
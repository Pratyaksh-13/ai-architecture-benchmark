import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProject, getArchitectures, runBenchmark, getBenchmarks, generateRecommendation, getRecommendation } from '../api/client'
import ArchitectureCard from '../components/ArchitectureCard'
import BenchmarkCharts from '../components/BenchmarkCharts'
import StatusBadge from '../components/StatusBadge'
import { SkeletonCard } from '../components/SkeletonCard'
import type { Project, Architecture, Benchmark, Recommendation } from '../types'

const ARCH_CONFIG: Record<string, { label: string; color: string }> = {
  monolithic: { label: 'Monolithic', color: '#14b8a6' },
  microservices: { label: 'Microservices', color: '#a78bfa' },
  event_driven: { label: 'Event-Driven', color: '#f59e0b' },
}

function RecommendationBanner({ rec }: { rec: Recommendation }) {
  const cfg = ARCH_CONFIG[rec.recommended_arch_type] ?? { label: rec.recommended_arch_type, color: '#a78bfa' }
  const confidence = Math.round(rec.confidence_score * 100)

  return (
    <div
      className="rounded-xl p-5 mb-8 animate-slide-in"
      style={{
        background: `linear-gradient(135deg, ${cfg.color}10 0%, #161b27 100%)`,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: cfg.color + '18', border: `1px solid ${cfg.color}30` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">AI Recommendation</span>
            <span
              className="text-xs font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full"
              style={{ color: cfg.color, background: cfg.color + '18', border: `1px solid ${cfg.color}30` }}
            >
              {cfg.label}
            </span>
            {/* Confidence bar */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">Confidence</span>
              <div className="flex items-center gap-1.5">
                <div className="w-24 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${confidence}%`, background: cfg.color }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: cfg.color }}>{confidence}%</span>
              </div>
            </div>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{rec.reasoning}</p>
          <p className="text-slate-600 text-xs mt-2">via {rec.llm_provider}</p>
        </div>
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
    }).finally(() => setLoading(false))
  }, [id])

  const handleBenchmark = async () => {
    if (!id) return
    setBenchmarking(true)
    setBenchmarkError('')
    try {
      const result = await runBenchmark(Number(id))
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
      <div className="animate-fade-in">
        <div className="h-4 w-48 bg-dark-700 rounded skeleton mb-6" />
        <div className="h-7 w-2/3 bg-dark-700 rounded skeleton mb-3" />
        <div className="h-5 w-20 bg-dark-700 rounded-full skeleton mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-slate-400 text-sm mb-2">Project not found</p>
        <Link to="/" className="text-accent-purple_light text-sm hover:underline">← Back to dashboard</Link>
      </div>
    )
  }

  const hasBenchmarks = benchmarks.length > 0
  const hasRecommendation = recommendation !== null

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-5">
        <Link to="/" className="hover:text-slate-400 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-400">Project #{project.id}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-xl font-semibold text-slate-100 leading-snug max-w-3xl">
            {project.requirement}
          </h1>
          <StatusBadge status={project.status} size="md" />
        </div>
        <p className="text-slate-600 text-xs">
          Created {new Date(project.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          {project.updated_at && ` · Updated ${new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap mb-8 pb-6 border-b border-dark-700">
        {/* Run benchmarks */}
        <button
          onClick={handleBenchmark}
          disabled={benchmarking || architectures.length === 0}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed bg-dark-700 border-dark-600 text-slate-300 hover:border-dark-500 hover:text-slate-200 hover:bg-dark-600"
        >
          {benchmarking ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-slate-300 rounded-full animate-spin" />
              Running benchmarks...
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              {hasBenchmarks ? 'Re-run Benchmarks' : 'Run Benchmarks'}
            </>
          )}
        </button>

        {/* Get recommendation — only enabled after benchmarks */}
        <div className="relative group">
          <button
            onClick={handleRecommend}
            disabled={recommending || !hasBenchmarks}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed bg-accent-purple/15 border-accent-purple/30 text-accent-purple_light hover:bg-accent-purple/25 hover:border-accent-purple/50"
          >
            {recommending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-accent-purple_light/40 border-t-accent-purple_light rounded-full animate-spin" />
                Analyzing architectures...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L9.8 5.8 15 6.3l-3.6 3.5.9 5L8 12.2 3.7 14.8l.9-5L1 6.3l5.2-.5L8 1z"
                    stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
                {hasRecommendation ? 'Re-analyze' : 'Get Recommendation'}
              </>
            )}
          </button>
          {/* Tooltip when disabled */}
          {!hasBenchmarks && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-dark-600 border border-dark-500 rounded-lg text-xs text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Run benchmarks first
            </div>
          )}
        </div>

        {/* Benchmark timestamp */}
        {hasBenchmarks && (
          <span className="text-xs text-slate-600 ml-1">
            Benchmarks from {new Date(benchmarks[0].created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}

        {/* Errors */}
        {benchmarkError && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            ⚠ {benchmarkError}
          </span>
        )}
        {recommendError && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            ⚠ {recommendError}
          </span>
        )}
      </div>

      {/* Recommendation banner */}
      {recommendation && (
        <RecommendationBanner rec={recommendation} />
      )}

      {/* Architecture cards */}
      {architectures.length > 0 ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-600">Architecture Proposals</p>
            <div className="flex-1 h-px bg-dark-700" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
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
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center mb-10">
          <p className="text-slate-500 text-sm">No architectures generated yet.</p>
        </div>
      )}

      {/* Benchmark section */}
      {hasBenchmarks && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-dark-700" />
          </div>
          <BenchmarkCharts architectures={architectures} benchmarks={benchmarks} />
        </>
      )}
    </div>
  )
}
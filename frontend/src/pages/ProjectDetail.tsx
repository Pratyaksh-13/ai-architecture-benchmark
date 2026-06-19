import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, getArchitectures, runBenchmark, getBenchmarks } from '../api/client'
import ArchitectureCard from '../components/ArchitectureCard'
import type { Project, Architecture, Benchmark } from '../types'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const ARCH_COLORS: Record<string, string> = {
  monolithic: '#14b8a6',
  microservices: '#a78bfa',
  event_driven: '#f59e0b',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [architectures, setArchitectures] = useState<Architecture[]>([])
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [benchmarking, setBenchmarking] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      getProject(Number(id)),
      getArchitectures(Number(id)),
      getBenchmarks(Number(id)),
    ]).then(([p, a, b]) => {
      setProject(p)
      setArchitectures(a.architectures)
      setBenchmarks(b.benchmarks)
    }).finally(() => setLoading(false))
  }, [id])

  const handleBenchmark = async () => {
    if (!id) return
    setBenchmarking(true)
    const result = await runBenchmark(Number(id))
    setBenchmarks(result.benchmarks)
    setBenchmarking(false)
  }

  // Build chart data — one entry per architecture type
  const latencyData = architectures.map(arch => {
    const bm = benchmarks.find(b => b.architecture_id === arch.id)
    return {
      name: arch.arch_type.replace('_', '-'),
      p50: bm?.latency_p50_ms ?? 0,
      p95: bm?.latency_p95_ms ?? 0,
      p99: bm?.latency_p99_ms ?? 0,
    }
  })

  const throughputData = architectures.map(arch => {
    const bm = benchmarks.find(b => b.architecture_id === arch.id)
    return {
      name: arch.arch_type.replace('_', '-'),
      'req/s': bm?.throughput_rps ?? 0,
    }
  })

  const radarData = ['latency_p99_ms', 'throughput_rps', 'error_rate_pct', 'cpu_usage_pct', 'memory_usage_mb'].map(metric => {
    const entry: Record<string, any> = { metric: metric.replace(/_/g, ' ').replace(' ms', '').replace(' pct', ' %').replace(' rps', ' rps') }
    architectures.forEach(arch => {
      const bm = benchmarks.find(b => b.architecture_id === arch.id)
      entry[arch.arch_type] = bm ? (bm as any)[metric] : 0
    })
    return entry
  })

  if (loading) return <p className="text-slate-500 text-sm">loading...</p>
  if (!project) return <p className="text-red-400 text-sm">project not found</p>

  return (
    <div>
      {/* Header */}
      <p className="text-slate-500 text-xs mb-1">project #{project.id}</p>
      <h1 className="text-xl font-medium text-slate-100 mb-2 max-w-3xl">{project.requirement}</h1>
      <div className="flex items-center gap-3 mb-8">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          project.status === 'done' ? 'bg-teal-900 text-teal-400' : 'bg-blue-950 text-blue-400'
        }`}>{project.status}</span>
        <button
          onClick={handleBenchmark}
          disabled={benchmarking}
          className="text-xs bg-accent-purple hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {benchmarking ? 'running benchmarks...' : benchmarks.length > 0 ? '↺ re-run benchmarks' : '▶ run benchmarks'}
        </button>
        {benchmarks.length > 0 && (
          <span className="text-xs text-slate-500">simulated · {new Date(benchmarks[0].created_at).toLocaleString()}</span>
        )}
      </div>

      {/* Architecture cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        {architectures.map(a => <ArchitectureCard key={a.id} arch={a} />)}
      </div>

      {/* Benchmark charts — only show after benchmarks run */}
      {benchmarks.length > 0 && (
        <div>
          <h2 className="text-base font-medium text-slate-200 mb-5">benchmark results</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

            {/* Latency comparison */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
              <p className="text-slate-400 text-sm mb-4">latency comparison (ms)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="p50" fill="#14b8a6" name="p50" radius={[4,4,0,0]} />
                  <Bar dataKey="p95" fill="#a78bfa" name="p95" radius={[4,4,0,0]} />
                  <Bar dataKey="p99" fill="#f59e0b" name="p99" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Throughput comparison */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
              <p className="text-slate-400 text-sm mb-4">throughput (requests/sec)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 8 }} />
                  <Bar dataKey="req/s" radius={[4,4,0,0]}>
                    {throughputData.map((entry, index) => (
                      <rect key={index} fill={Object.values(ARCH_COLORS)[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            {architectures.map(arch => {
              const bm = benchmarks.find(b => b.architecture_id === arch.id)
              if (!bm) return null
              const color = ARCH_COLORS[arch.arch_type] ?? '#64748b'
              return (
                <div key={arch.id} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                  <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color }}>
                    {arch.arch_type.replace('_', '-')}
                  </p>
                  <div className="space-y-3">
                    {[
                      { label: 'p99 latency', value: `${bm.latency_p99_ms} ms` },
                      { label: 'throughput', value: `${bm.throughput_rps.toLocaleString()} req/s` },
                      { label: 'error rate', value: `${bm.error_rate_pct}%` },
                      { label: 'cpu usage', value: `${bm.cpu_usage_pct}%` },
                      { label: 'memory', value: `${bm.memory_usage_mb} MB` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-slate-200 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
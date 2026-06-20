import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import type { Architecture, Benchmark } from '../types'

const ARCH_COLORS: Record<string, string> = {
  monolithic: '#14b8a6',
  microservices: '#a78bfa',
  event_driven: '#f59e0b',
}

const ARCH_LABELS: Record<string, string> = {
  monolithic: 'Monolithic',
  microservices: 'Microservices',
  event_driven: 'Event-Driven',
}

const tooltipStyle = {
  background: '#161b27',
  border: '1px solid #1e2535',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

const axisStyle = { fill: '#475569', fontSize: 11 }
const gridStyle = { strokeDasharray: '3 3', stroke: '#1e2535' }

interface Props {
  architectures: Architecture[]
  benchmarks: Benchmark[]
}

export default function BenchmarkCharts({ architectures, benchmarks }: Props) {
  const latencyData = architectures.map(arch => {
    const bm = benchmarks.find(b => b.architecture_id === arch.id)
    return {
      name: ARCH_LABELS[arch.arch_type] ?? arch.arch_type,
      archType: arch.arch_type,
      p50: bm?.latency_p50_ms ?? 0,
      p95: bm?.latency_p95_ms ?? 0,
      p99: bm?.latency_p99_ms ?? 0,
    }
  })

  const throughputData = architectures.map(arch => {
    const bm = benchmarks.find(b => b.architecture_id === arch.id)
    return {
      name: ARCH_LABELS[arch.arch_type] ?? arch.arch_type,
      archType: arch.arch_type,
      rps: bm?.throughput_rps ?? 0,
    }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-base font-semibold text-slate-200">Benchmark Results</h2>
        <span className="text-[10px] font-medium tracking-widest uppercase text-slate-600 bg-dark-700 border border-dark-600 px-2 py-0.5 rounded-full">
          simulated
        </span>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Latency chart */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-300 mb-1">Latency Comparison</p>
          <p className="text-xs text-slate-600 mb-4">p50 / p95 / p99 in milliseconds</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={latencyData} barCategoryGap="25%">
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit=" ms" />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(30,37,53,0.5)' }}
                formatter={(v) => [v != null ? `${v} ms` : '—']}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#475569', paddingTop: 12 }}
                formatter={(v) => v.toUpperCase()}
              />
              <Bar dataKey="p50" name="p50" fill="#14b8a6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="p95" name="p95" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="p99" name="p99" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput chart */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-300 mb-1">Throughput</p>
          <p className="text-xs text-slate-600 mb-4">Requests per second by architecture</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={throughputData} barCategoryGap="30%">
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit=" rps" />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(30,37,53,0.5)' }}
                formatter={(v) => [v != null ? (typeof v === 'number' ? `${v.toLocaleString()} req/s` : `${v} req/s`) : '—']}
              />
              <Bar dataKey="rps" name="Throughput" radius={[3, 3, 0, 0]}>
                {throughputData.map((entry, i) => (
                  <Cell key={i} fill={ARCH_COLORS[entry.archType] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {architectures.map(arch => {
          const bm = benchmarks.find(b => b.architecture_id === arch.id)
          if (!bm) return null
          const color = ARCH_COLORS[arch.arch_type] ?? '#64748b'
          const label = ARCH_LABELS[arch.arch_type] ?? arch.arch_type

          const metrics = [
            {
              label: 'P50 Latency',
              value: `${bm.latency_p50_ms} ms`,
              highlight: false,
            },
            {
              label: 'P95 Latency',
              value: `${bm.latency_p95_ms} ms`,
              highlight: false,
            },
            {
              label: 'P99 Latency',
              value: `${bm.latency_p99_ms} ms`,
              highlight: bm.latency_p99_ms > 500,
              highlightColor: 'text-amber-400',
            },
            {
              label: 'Throughput',
              value: `${bm.throughput_rps.toLocaleString()} req/s`,
              highlight: false,
            },
            {
              label: 'Error Rate',
              value: `${bm.error_rate_pct}%`,
              highlight: bm.error_rate_pct > 1,
              highlightColor: 'text-red-400',
            },
            {
              label: 'CPU Usage',
              value: `${bm.cpu_usage_pct}%`,
              highlight: bm.cpu_usage_pct > 80,
              highlightColor: 'text-amber-400',
            },
            {
              label: 'Memory',
              value: `${bm.memory_usage_mb} MB`,
              highlight: false,
            },
          ]

          return (
            <div key={arch.id} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color }}>
                  {label}
                </p>
              </div>
              <div className="space-y-2.5">
                {metrics.map(({ label: mLabel, value, highlight, highlightColor }) => (
                  <div key={mLabel} className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 text-xs">{mLabel}</span>
                    <span className={`font-medium text-xs tabular-nums ${highlight ? (highlightColor ?? '') : 'text-slate-300'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

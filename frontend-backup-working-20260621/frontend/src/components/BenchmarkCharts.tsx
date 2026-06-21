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
import CountUp from './CountUp'

const ARCH_COLORS: Record<string, string> = {
  monolithic: '#2952A3',      // structural blue
  microservices: '#6B6558',   // graphite
  event_driven: '#1B2330',    // ink
}

const ARCH_LABELS: Record<string, string> = {
  monolithic: 'Monolithic',
  microservices: 'Microservices',
  event_driven: 'Event-Driven',
}

const tooltipStyle = {
  background: '#F2EFE6',
  border: '1px solid #C9C2AE',
  borderRadius: 0,
  color: '#1B2330',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
}

const axisStyle = { fill: '#6B6558', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }
const gridStyle = { strokeDasharray: '2 2', stroke: 'rgba(201, 194, 174, 0.4)' }

interface Props {
  architectures: Architecture[]
  benchmarks: Benchmark[]
}

export default function BenchmarkCharts({ architectures, benchmarks }: Props) {
  // Extract benchmarks for each type
  const monoArch = architectures.find(a => a.arch_type === 'monolithic')
  const microArch = architectures.find(a => a.arch_type === 'microservices')
  const eventArch = architectures.find(a => a.arch_type === 'event_driven')

  const monoBm = monoArch ? benchmarks.find(b => b.architecture_id === monoArch.id) : undefined
  const microBm = microArch ? benchmarks.find(b => b.architecture_id === microArch.id) : undefined
  const eventBm = eventArch ? benchmarks.find(b => b.architecture_id === eventArch.id) : undefined

  // Helpers to determine best performance highlights
  const getOptimal = (type: 'min' | 'max', ...vals: (number | undefined)[]) => {
    const list = vals.filter((v): v is number => v !== undefined)
    if (list.length === 0) return null
    return type === 'min' ? Math.min(...list) : Math.max(...list)
  }

  const p50Best = getOptimal('min', monoBm?.latency_p50_ms, microBm?.latency_p50_ms, eventBm?.latency_p50_ms)
  const p95Best = getOptimal('min', monoBm?.latency_p95_ms, microBm?.latency_p95_ms, eventBm?.latency_p95_ms)
  const p99Best = getOptimal('min', monoBm?.latency_p99_ms, microBm?.latency_p99_ms, eventBm?.latency_p99_ms)
  const throughputBest = getOptimal('max', monoBm?.throughput_rps, microBm?.throughput_rps, eventBm?.throughput_rps)
  const errorBest = getOptimal('min', monoBm?.error_rate_pct, microBm?.error_rate_pct, eventBm?.error_rate_pct)
  const cpuBest = getOptimal('min', monoBm?.cpu_usage_pct, microBm?.cpu_usage_pct, eventBm?.cpu_usage_pct)
  const memoryBest = getOptimal('min', monoBm?.memory_usage_mb, microBm?.memory_usage_mb, eventBm?.memory_usage_mb)

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
      Throughput: bm?.throughput_rps ?? 0,
    }
  })

  // Specs Sheet table helper renderer
  const renderTableCell = (val: number | undefined, bestVal: number | null, formatter: (v: number) => string) => {
    if (val === undefined) return <td className="p-3 border-r border-hairline text-right text-graphite/40 font-mono">—</td>
    const isBest = val === bestVal
    return (
      <td className={`p-3 border-r border-hairline text-right font-mono ${isBest ? 'text-blueprint font-bold bg-blueprint/5' : 'text-ink'}`}>
        <CountUp value={val} formatter={formatter} />
        {isBest && <span className="text-[8px] font-bold tracking-wider ml-1 text-blueprint">[BEST]</span>}
      </td>
    )
  }

  return (
    <div className="font-mono text-left">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-bold tracking-widest uppercase text-blueprint">SIMULATED BENCHMARK REPORT</h2>
        <span className="text-[9px] font-bold tracking-widest uppercase text-graphite bg-hairline/30 border border-hairline px-2.5 py-0.5 rounded-sm">
          SIMULATED RUN
        </span>
      </div>

      {/* Engineering Spec Sheet Comparison Table */}
      <div className="border border-hairline bg-paper rounded-sm overflow-hidden text-xs mb-8">
        <div className="bg-hairline/10 border-b border-hairline px-4 py-2.5 text-[9px] font-bold text-graphite tracking-widest">
          SPECIFICATION COMPARISON LEDGER SHEET
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-hairline/5 text-[9px] font-bold text-graphite">
                <th className="p-3 border-r border-hairline text-left tracking-wider">METRIC METRICS SHEET</th>
                <th className="p-3 border-r border-hairline text-right tracking-wider">MONOLITHIC</th>
                <th className="p-3 border-r border-hairline text-right tracking-wider">MICROSERVICES</th>
                <th className="p-3 text-right tracking-wider">EVENT-DRIVEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">LATENCY (P50)</td>
                {renderTableCell(monoBm?.latency_p50_ms, p50Best, (v) => `${v.toFixed(0)} MS`)}
                {renderTableCell(microBm?.latency_p50_ms, p50Best, (v) => `${v.toFixed(0)} MS`)}
                {renderTableCell(eventBm?.latency_p50_ms, p50Best, (v) => `${v.toFixed(0)} MS`)}
              </tr>
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">LATENCY (P95)</td>
                {renderTableCell(monoBm?.latency_p95_ms, p95Best, (v) => `${v.toFixed(0)} MS`)}
                {renderTableCell(microBm?.latency_p95_ms, p95Best, (v) => `${v.toFixed(0)} MS`)}
                {renderTableCell(eventBm?.latency_p95_ms, p95Best, (v) => `${v.toFixed(0)} MS`)}
              </tr>
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">LATENCY (P99)</td>
                {renderTableCell(monoBm?.latency_p99_ms, p99Best, (v) => `${v.toFixed(0)} MS`)}
                {renderTableCell(microBm?.latency_p99_ms, p99Best, (v) => `${v.toFixed(0)} MS`)}
                {renderTableCell(eventBm?.latency_p99_ms, p99Best, (v) => `${v.toFixed(0)} MS`)}
              </tr>
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">THROUGHPUT RATE</td>
                {renderTableCell(monoBm?.throughput_rps, throughputBest, (v) => `${Math.round(v).toLocaleString()} RPS`)}
                {renderTableCell(microBm?.throughput_rps, throughputBest, (v) => `${Math.round(v).toLocaleString()} RPS`)}
                {renderTableCell(eventBm?.throughput_rps, throughputBest, (v) => `${Math.round(v).toLocaleString()} RPS`)}
              </tr>
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">SIMULATION ERROR RATE</td>
                {renderTableCell(monoBm?.error_rate_pct, errorBest, (v) => `${v.toFixed(2)}%`)}
                {renderTableCell(microBm?.error_rate_pct, errorBest, (v) => `${v.toFixed(2)}%`)}
                {renderTableCell(eventBm?.error_rate_pct, errorBest, (v) => `${v.toFixed(2)}%`)}
              </tr>
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">CPU UTILIZATION</td>
                {renderTableCell(monoBm?.cpu_usage_pct, cpuBest, (v) => `${v.toFixed(1)}%`)}
                {renderTableCell(microBm?.cpu_usage_pct, cpuBest, (v) => `${v.toFixed(1)}%`)}
                {renderTableCell(eventBm?.cpu_usage_pct, cpuBest, (v) => `${v.toFixed(1)}%`)}
              </tr>
              <tr className="hover:bg-hairline/5">
                <td className="p-3 border-r border-hairline font-bold text-ink">MEMORY FOOTPRINT</td>
                {renderTableCell(monoBm?.memory_usage_mb, memoryBest, (v) => `${v.toFixed(0)} MB`)}
                {renderTableCell(microBm?.memory_usage_mb, memoryBest, (v) => `${v.toFixed(0)} MB`)}
                {renderTableCell(eventBm?.memory_usage_mb, memoryBest, (v) => `${v.toFixed(0)} MB`)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Vector Blueprint Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 font-mono">
        {/* Latency diagram */}
        <div className="bg-paper border border-hairline rounded-sm p-5">
          <p className="text-xs font-bold text-blueprint uppercase mb-1">LATENCY SPECTRUM CHART</p>
          <p className="text-[10px] text-graphite uppercase mb-4">P50 / P95 / P99 IN MILLISECONDS</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={latencyData} barCategoryGap="25%">
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: '#C9C2AE' }} tickLine={{ stroke: '#C9C2AE' }} />
              <YAxis tick={axisStyle} axisLine={{ stroke: '#C9C2AE' }} tickLine={{ stroke: '#C9C2AE' }} unit=" ms" />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(201, 194, 174, 0.15)' }}
                formatter={(v) => [v != null ? `${v} ms` : '—']}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: '#6B6558', paddingTop: 12, fontFamily: 'JetBrains Mono' }}
                formatter={(v) => v.toUpperCase()}
              />
              <Bar dataKey="p50" name="p50" fill="#2952A3" />
              <Bar dataKey="p95" name="p95" fill="#6B6558" />
              <Bar dataKey="p99" name="p99" fill="#1B2330" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput diagram */}
        <div className="bg-paper border border-hairline rounded-sm p-5">
          <p className="text-xs font-bold text-blueprint uppercase mb-1">THROUGHPUT VOLUME CHART</p>
          <p className="text-[10px] text-graphite uppercase mb-4">REQUESTS PER SECOND CAPACITY</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={throughputData} barCategoryGap="30%">
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: '#C9C2AE' }} tickLine={{ stroke: '#C9C2AE' }} />
              <YAxis tick={axisStyle} axisLine={{ stroke: '#C9C2AE' }} tickLine={{ stroke: '#C9C2AE' }} unit=" rps" />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(201, 194, 174, 0.15)' }}
                formatter={(v) => [v != null ? `${Math.round(Number(v)).toLocaleString()} req/s` : '—']}
              />
              <Bar dataKey="Throughput" fill="#2952A3">
                {throughputData.map((entry, i) => {
                  const color = ARCH_COLORS[entry.archType] ?? '#2952A3'
                  return <Cell key={i} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}


import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects, deleteProject } from '../api/client'
import type { Project } from '../types'
import StatusBadge from '../components/StatusBadge'
import { SkeletonRow, SkeletonStat } from '../components/SkeletonCard'
import PageTransition from '../components/PageTransition'

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-hairline bg-paper rounded-sm">
      <div className="w-16 h-16 border border-hairline flex items-center justify-center mb-4 text-graphite bg-transparent">
        <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="2" y="3" width="12" height="10" />
          <path d="M2 6h12M5 9h6M5 11h3" />
        </svg>
      </div>
      <p className="text-ink font-serif font-bold text-base mb-1">No comparisons yet</p>
      <p className="text-graphite font-mono text-[11px] mb-6 text-center max-w-xs uppercase tracking-wide">
        Describe a software system spec to begin drafting architectures.
      </p>
      <Link
        to="/new"
        className="inline-flex items-center gap-2 bg-blueprint hover:bg-[#1E3D7D] text-paper font-mono uppercase tracking-wider text-xs font-bold px-5 py-2.5 rounded-sm transition-colors duration-100"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v12M2 8h12" />
        </svg>
        New Comparison
      </Link>
    </div>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    getProjects()
      .then(r => setProjects(r.projects))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this architecture comparison block?')) return
    setDeletingId(id)
    try {
      await deleteProject(id)
      setProjects(p => p.filter(x => x.id !== id))
    } catch {
      alert('Failed to delete comparison block.')
    } finally {
      setDeletingId(null)
    }
  }

  const done = projects.filter(p => p.status === 'done').length
  const total = projects.length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0

  const stats = [
    {
      label: 'TOTAL PROJECTS',
      value: total,
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blueprint">
          <rect x="2" y="2" width="5" height="5" />
          <rect x="9" y="2" width="5" height="5" />
          <rect x="2" y="9" width="5" height="5" />
          <rect x="9" y="9" width="5" height="5" />
        </svg>
      ),
    },
    {
      label: 'ARCHITECTURES GENERATED',
      value: done * 3,
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blueprint">
          <polygon points="8,2 14,5 14,11 8,14 2,11 2,5" />
          <line x1="8" y1="2" x2="8" y2="14" />
        </svg>
      ),
    },
    {
      label: 'COMPLETION RATE',
      value: `${rate}%`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blueprint">
          <circle cx="8" cy="8" r="6" />
          <path d="M5 8l2 2 4-4" />
        </svg>
      ),
    },
  ]

  return (
    <PageTransition>
      <div>
        {/* Title / Header */}
        <div className="flex items-center justify-between mb-8 pb-5 border-b border-hairline">
          <div>
            <h1 className="text-3xl font-serif font-bold text-ink tracking-tight">Ledger Dashboard</h1>
            <p className="text-graphite font-mono text-[10px] tracking-wider uppercase mt-1">
              SYSTEM ARCHITECTURE COMPARISONS & SIMULATIONS LEDGER
            </p>
          </div>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 bg-blueprint hover:bg-[#1E3D7D] text-paper font-mono uppercase tracking-wider text-xs font-bold px-4 py-2.5 rounded-sm transition-colors duration-100"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 2v12M2 8h12" />
            </svg>
            New Project
          </Link>
        </div>

        {/* Technical Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonStat key={i} />)
            : stats.map(({ label, value, icon }) => (
              <div key={label} className="bg-paper border border-hairline rounded-sm p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-graphite font-mono text-[9px] tracking-wider font-semibold">{label}</span>
                  <span>{icon}</span>
                </div>
                <p className="text-3xl font-mono font-bold text-ink tabular-nums tracking-tight">{value}</p>
              </div>
            ))
          }
        </div>

        {/* Ledger Category Header */}
        <div className="flex items-center gap-3 mb-5">
          <p className="text-[10px] font-mono font-semibold tracking-widest uppercase text-graphite">SPECIFICATION ENTRIES</p>
          <div className="flex-1 h-px bg-hairline" />
          {!loading && projects.length > 0 && (
            <span className="text-[10px] font-mono text-graphite tracking-wide">TOTAL: {projects.length} RECORDS</span>
          )}
        </div>

        {/* Ledger Entries List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {projects.map(p => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group flex items-center justify-between bg-paper border border-hairline rounded-sm px-5 py-4 hover:border-blueprint hover:bg-hairline/10 transition-colors duration-100"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-ink text-sm font-medium line-clamp-1 group-hover:text-blueprint transition-colors duration-100">
                    {p.requirement}
                  </p>
                  <p className="text-graphite font-mono text-[10px] mt-1.5 uppercase tracking-wide">
                    ENTRY #{p.id} · RECORDED {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <StatusBadge status={p.status} />
                  <button
                    onClick={e => handleDelete(e, p.id)}
                    disabled={deletingId === p.id}
                    className="text-graphite hover:text-annotation transition-colors duration-100 p-1 rounded-sm border border-transparent hover:border-hairline bg-transparent"
                    title="Delete project record"
                  >
                    {deletingId === p.id ? (
                      <svg className="animate-spin text-blueprint" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <path d="M2 3h12M5 3V1h6v2M3 3v11h10V3" />
                        <path d="M6 6v5M10 6v5" />
                      </svg>
                    )}
                  </button>
                  <svg
                    width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                    className="text-graphite group-hover:text-blueprint transition-colors duration-100 flex-shrink-0"
                  >
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
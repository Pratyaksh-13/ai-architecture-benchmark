import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects, deleteProject } from '../api/client'
import type { Project } from '../types'
import StatusBadge from '../components/StatusBadge'
import { SkeletonRow, SkeletonStat } from '../components/SkeletonCard'

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      {/* SVG illustration */}
      <div className="w-20 h-20 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mb-5">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="4" y="8" width="28" height="20" rx="3" stroke="#2d3748" strokeWidth="2"/>
          <path d="M4 13h28" stroke="#2d3748" strokeWidth="1.5"/>
          <circle cx="18" cy="22" r="4" stroke="#4c1d95" strokeWidth="1.5"/>
          <path d="M18 20v4M16 22h4" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-slate-300 font-medium text-base mb-1">No projects yet</p>
      <p className="text-slate-600 text-sm mb-6 text-center max-w-xs">
        Create your first project and let the AI generate architecture proposals with benchmarks.
      </p>
      <Link
        to="/new"
        className="inline-flex items-center gap-2 bg-accent-purple hover:bg-purple-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-150 hover:shadow-lg hover:shadow-accent-purple/20"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Create first project
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
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    setDeletingId(id)
    await deleteProject(id)
    setProjects(p => p.filter(x => x.id !== id))
    setDeletingId(null)
  }

  const done = projects.filter(p => p.status === 'done').length
  const total = projects.length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0

  const stats = [
    {
      label: 'Total Projects',
      value: total,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#7c3aed" opacity="0.7"/>
          <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#7c3aed" opacity="0.4"/>
          <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#7c3aed" opacity="0.4"/>
          <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#7c3aed" opacity="0.2"/>
        </svg>
      ),
    },
    {
      label: 'Architectures Generated',
      value: done * 3,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L14 6v4L8 14 2 10V6L8 2z" stroke="#14b8a6" strokeWidth="1.5"/>
          <path d="M8 6v4M6 8h4" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Completion Rate',
      value: `${rate}%`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="#f59e0b" strokeWidth="1.5"/>
          <path d="M5 8l2 2 4-4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your architecture benchmarking projects</p>
        </div>
        <Link
          to="/new"
          className="inline-flex items-center gap-2 bg-accent-purple hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150 hover:shadow-lg hover:shadow-accent-purple/20"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonStat key={i} />)
          : stats.map(({ label, value, icon }) => (
            <div key={label} className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-dark-600 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span>{icon}</span>
              </div>
              <p className="text-3xl font-bold text-slate-100 tabular-nums tracking-tight">{value}</p>
              <p className="text-slate-500 text-xs mt-1 font-medium">{label}</p>
            </div>
          ))
        }
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <p className="text-xs font-semibold tracking-widest uppercase text-slate-600">Projects</p>
        <div className="flex-1 h-px bg-dark-700" />
        {!loading && projects.length > 0 && (
          <span className="text-xs text-slate-600">{projects.length} total</span>
        )}
      </div>

      {/* Project list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2 animate-fade-in">
          {projects.map(p => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="group flex items-center justify-between bg-dark-800 border border-dark-700 rounded-xl px-5 py-4 hover:border-dark-600 hover:bg-dark-750 transition-all duration-150"
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-slate-200 text-sm font-medium line-clamp-1 group-hover:text-slate-100 transition-colors">
                  {p.requirement}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  #{p.id} · {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={p.status} />
                <button
                  onClick={e => handleDelete(e, p.id)}
                  disabled={deletingId === p.id}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all duration-150 p-1 rounded"
                  title="Delete project"
                >
                  {deletingId === p.id ? (
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <svg
                  width="12" height="12" viewBox="0 0 16 16" fill="none"
                  className="text-slate-700 group-hover:text-slate-500 transition-colors flex-shrink-0"
                >
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
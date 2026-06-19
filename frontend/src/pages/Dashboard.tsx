import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects } from '../api/client'
import type { Project } from '../types'

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProjects()
      .then(r => setProjects(r.projects))
      .finally(() => setLoading(false))
  }, [])

  const done = projects.filter(p => p.status === 'done').length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-medium text-slate-100">dashboard</h1>
        <Link to="/new" className="bg-accent-purple hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + new project
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'total projects', value: projects.length },
          { label: 'architectures generated', value: done * 3 },
          { label: 'completed', value: done },
        ].map(({ label, value }) => (
          <div key={label} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
            <p className="text-3xl font-semibold text-slate-100">{value}</p>
            <p className="text-slate-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 text-sm mb-4">no projects yet</p>
          <Link to="/new" className="text-accent-purple_light text-sm underline">create your first project →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="flex items-center justify-between bg-dark-800 border border-dark-700 rounded-xl px-5 py-4 hover:border-dark-600 transition-colors">
              <div>
                <p className="text-slate-200 text-sm font-medium line-clamp-1">{p.requirement}</p>
                <p className="text-slate-500 text-xs mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                p.status === 'done' ? 'bg-teal-900 text-teal-400' : 'bg-blue-950 text-blue-400'
              }`}>
                {p.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
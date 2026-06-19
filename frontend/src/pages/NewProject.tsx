import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, generateArchitectures } from '../api/client'

export default function NewProject() {
  const [requirement, setRequirement] = useState('')
  const [provider, setProvider] = useState('openai')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (requirement.trim().length < 10) {
      setError('requirement must be at least 10 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const project = await createProject(requirement)
      await generateArchitectures(project.id, provider)
      navigate(`/projects/${project.id}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium text-slate-100 mb-8">new project</h1>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-5">
        <div>
          <label className="text-slate-400 text-sm block mb-2">requirement</label>
          <textarea
            rows={4}
            value={requirement}
            onChange={e => setRequirement(e.target.value)}
            placeholder="e.g. Build a scalable URL shortener that handles 10k requests per second"
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-purple resize-none"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm block mb-2">llm provider</label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-accent-purple"
          >
            <option value="openai">openrouter (free)</option>
            <option value="claude">claude (direct)</option>
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-accent-purple hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'generating architectures...' : 'generate architectures →'}
        </button>

        {loading && (
          <p className="text-slate-500 text-xs">this takes 10–20 seconds — the LLM is generating 3 architectures with diagrams</p>
        )}
      </div>
    </div>
  )
}
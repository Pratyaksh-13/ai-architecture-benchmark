import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import type { Architecture } from '../types'

mermaid.initialize({
  theme: 'dark',
  startOnLoad: false,
  suppressErrorRendering: true,
})

const typeColors: Record<string, string> = {
  monolithic: 'text-teal-400',
  microservices: 'text-purple-400',
  event_driven: 'text-amber-400',
}

interface Props {
  arch: Architecture
  isRecommended?: boolean
}

export default function ArchitectureCard({ arch, isRecommended }: Props) {
  const mermaidRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mermaidRef.current) return
    const id = `mermaid-${arch.id}`
    mermaid.render(id, arch.mermaid_diagram).then(({ svg }) => {
      if (mermaidRef.current) mermaidRef.current.innerHTML = svg
    }).catch(() => {
      if (mermaidRef.current) mermaidRef.current.innerHTML =
        `<pre style="font-size:10px; color:#64748b; white-space:pre-wrap; word-break:break-all">${arch.mermaid_diagram}</pre>`
    })
  }, [arch.mermaid_diagram, arch.id])

  return (
    <div className={`bg-dark-800 rounded-xl p-5 relative ${
      isRecommended ? 'border-2 border-amber-500' : 'border border-dark-700'
    }`}>
      {isRecommended && (
        <span className="absolute -top-2.5 left-4 bg-amber-500 text-dark-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
          ✨ BEST FIT
        </span>
      )}

      <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${typeColors[arch.arch_type] ?? 'text-slate-400'}`}>
        {arch.arch_type.replace('_', '-')}
      </p>
      <p className="text-slate-300 text-sm leading-relaxed mb-4">{arch.explanation}</p>

      <div ref={mermaidRef} className="bg-dark-900 rounded-lg p-3 mb-4 overflow-auto" />

      {arch.tradeoffs && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-teal-400 font-medium mb-1">pros</p>
            <ul className="space-y-1">
              {arch.tradeoffs.pros.map((p, i) => (
                <li key={i} className="text-slate-400">+ {p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-red-400 font-medium mb-1">cons</p>
            <ul className="space-y-1">
              {arch.tradeoffs.cons.map((c, i) => (
                <li key={i} className="text-slate-400">− {c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="text-slate-600 text-xs mt-4">via {arch.llm_provider}</p>
    </div>
  )
}
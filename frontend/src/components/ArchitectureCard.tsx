import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import type { Architecture } from '../types'

mermaid.initialize({
  theme: 'dark',
  startOnLoad: false,
  suppressErrorRendering: true,
  themeVariables: {
    background: '#161b27',
    primaryColor: '#1e2535',
    primaryTextColor: '#94a3b8',
    lineColor: '#475569',
    secondaryColor: '#252d3d',
    tertiaryColor: '#1a2030',
    edgeLabelBackground: '#161b27',
  },
})

const ARCH_CONFIG: Record<string, { label: string; color: string; bgDim: string; borderActive: string }> = {
  monolithic: {
    label: 'Monolithic',
    color: '#14b8a6',
    bgDim: 'rgba(20,184,166,0.06)',
    borderActive: '#14b8a6',
  },
  microservices: {
    label: 'Microservices',
    color: '#a78bfa',
    bgDim: 'rgba(167,139,250,0.06)',
    borderActive: '#a78bfa',
  },
  event_driven: {
    label: 'Event-Driven',
    color: '#f59e0b',
    bgDim: 'rgba(245,158,11,0.06)',
    borderActive: '#f59e0b',
  },
}

interface Props {
  arch: Architecture
  isRecommended?: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors px-2 py-0.5 rounded border border-dark-600 hover:border-dark-500"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  )
}

export default function ArchitectureCard({ arch, isRecommended }: Props) {
  const mermaidRef = useRef<HTMLDivElement>(null)
  const [mermaidFailed, setMermaidFailed] = useState(false)
  const [dockerOpen, setDockerOpen] = useState(false)
  const cfg = ARCH_CONFIG[arch.arch_type] ?? { label: arch.arch_type, color: '#64748b', bgDim: 'transparent', borderActive: '#64748b' }

  useEffect(() => {
    if (!mermaidRef.current) return
    setMermaidFailed(false)
    const id = `mermaid-${arch.id}-${Date.now()}`
    mermaid.render(id, arch.mermaid_diagram)
      .then(({ svg }) => {
        if (mermaidRef.current) mermaidRef.current.innerHTML = svg
      })
      .catch(() => {
        setMermaidFailed(true)
        if (mermaidRef.current) mermaidRef.current.innerHTML = ''
      })
  }, [arch.mermaid_diagram, arch.id])

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: isRecommended ? cfg.bgDim : '#161b27',
        border: isRecommended
          ? `2px solid ${cfg.borderActive}`
          : '1px solid #1e2535',
        boxShadow: isRecommended
          ? `0 0 0 1px ${cfg.borderActive}22, 0 4px 24px ${cfg.borderActive}18`
          : 'none',
      }}
    >
      {/* Best fit banner */}
      {isRecommended && (
        <div
          className="w-full py-1.5 px-5 flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase animate-slide-in"
          style={{ background: cfg.borderActive + '22', borderBottom: `1px solid ${cfg.borderActive}44` }}
        >
          <span style={{ color: cfg.color }}>★ Best Fit</span>
          <span className="ml-auto font-normal text-slate-500 text-[10px] tracking-normal normal-case">AI recommended</span>
        </div>
      )}

      <div className="p-5">
        {/* Type badge */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border"
            style={{ color: cfg.color, background: cfg.color + '18', borderColor: cfg.color + '40' }}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-600">via {arch.llm_provider}</span>
        </div>

        {/* Explanation */}
        <p className="text-slate-300 text-sm leading-relaxed mb-4">{arch.explanation}</p>

        {/* Mermaid diagram */}
        <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 mb-4 overflow-auto min-h-[100px] mermaid-container">
          {mermaidFailed ? (
            <pre className="code-block text-slate-600 whitespace-pre-wrap break-all text-[10px]">
              {arch.mermaid_diagram}
            </pre>
          ) : (
            <div ref={mermaidRef} />
          )}
        </div>

        {/* Pros / Cons */}
        {arch.tradeoffs && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-teal-500 mb-2">Pros</p>
              <ul className="space-y-1.5">
                {arch.tradeoffs.pros.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400 leading-relaxed">
                    <span className="text-teal-500 mt-0.5 flex-shrink-0">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-rose-500 mb-2">Cons</p>
              <ul className="space-y-1.5">
                {arch.tradeoffs.cons.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400 leading-relaxed">
                    <span className="text-rose-500 mt-0.5 flex-shrink-0">✗</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Docker Compose collapsible */}
        {arch.docker_compose && (
          <div className="border border-dark-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setDockerOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-dark-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium tracking-widest uppercase text-slate-600">docker-compose.yml</span>
              </span>
              <div className="flex items-center gap-2">
                <CopyButton text={arch.docker_compose} />
                <span className="text-xs transition-transform duration-200" style={{ transform: dockerOpen ? 'rotate(180deg)' : 'none' }}>
                  ▾
                </span>
              </div>
            </button>
            {dockerOpen && (
              <pre className="code-block bg-dark-950 text-slate-400 px-4 py-3 overflow-auto max-h-64 text-[11px] border-t border-dark-600">
                {arch.docker_compose}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import type { Architecture } from '../types'

// Initialize Mermaid with warm blueprint themes
mermaid.initialize({
  theme: 'base',
  startOnLoad: false,
  suppressErrorRendering: true,
  themeVariables: {
    background: '#F2EFE6',
    primaryColor: '#F2EFE6',
    primaryTextColor: '#1B2330',
    primaryBorderColor: '#2952A3',
    lineColor: '#2952A3',
    secondaryColor: '#C9C2AE',
    tertiaryColor: '#F2EFE6',
    edgeLabelBackground: '#F2EFE6',
    noteBkgColor: '#F2EFE6',
    noteTextColor: '#1B2330',
    noteBorderColor: '#C9C2AE',
    actorLineColor: '#2952A3',
    actorBkg: '#F2EFE6',
    actorTextColor: '#1B2330',
    signalColor: '#2952A3',
    signalLineColor: '#2952A3',
    labelTextColor: '#1B2330',
    loopBkg: '#F2EFE6',
    loopLineColor: '#2952A3',
  },
})

// Single-weight line-art icons for architecture types (no fill)
const ARCH_ICONS: Record<string, React.ReactNode> = {
  monolithic: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="3" width="12" height="12" />
    </svg>
  ),
  microservices: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2" y="2" width="4" height="4" />
      <rect x="12" y="2" width="4" height="4" />
      <rect x="7" y="12" width="4" height="4" />
      <path d="M4 6v6h3M14 6v6H11" />
    </svg>
  ),
  event_driven: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
      <circle cx="3" cy="9" r="2" />
      <circle cx="15" cy="4" r="2" />
      <circle cx="15" cy="14" r="2" />
      <path d="M5 9h4M9 9V4h4M9 9v5h4" />
    </svg>
  ),
}

const ARCH_LABEL_MAP: Record<string, string> = {
  monolithic: 'MONOLITHIC SPEC',
  microservices: 'MICROSERVICES SPEC',
  event_driven: 'EVENT-DRIVEN SPEC',
}

interface Props {
  arch: Architecture
  isRecommended?: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <button
      onClick={copy}
      className="text-[9px] font-mono font-bold text-graphite hover:text-ink transition-colors px-2 py-0.5 rounded-sm border border-hairline bg-transparent hover:bg-hairline/20"
    >
      {copied ? '[ COPIED ]' : '[ COPY ]'}
    </button>
  )
}

export default function ArchitectureCard({ arch, isRecommended }: Props) {
  const mermaidRef = useRef<HTMLDivElement>(null)
  const [mermaidFailed, setMermaidFailed] = useState(false)
  const [dockerOpen, setDockerOpen] = useState(false)

  useEffect(() => {
    if (!mermaidRef.current) return
    setMermaidFailed(false)
    const id = `mermaid-${arch.id}-${Date.now()}`
    
    // Clear initial content before rendering
    mermaidRef.current.innerHTML = ''
    
    mermaid.render(id, arch.mermaid_diagram)
      .then(({ svg }) => {
        if (!mermaidRef.current) return
        mermaidRef.current.innerHTML = svg

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReduced) return

        // Implement diagram drawing-on animation by setting dash properties on shapes
        const paths = mermaidRef.current.querySelectorAll('path, rect, circle, polygon, ellipse')
        paths.forEach((path) => {
          if (path.classList.contains('marker') || path.tagName.toLowerCase() === 'text') return
          try {
            const length = (path as SVGGeometryElement).getTotalLength()
            if (length > 0) {
              path.setAttribute('style', `
                stroke-dasharray: ${length};
                stroke-dashoffset: ${length};
                animation: drawStroke 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
              `)
            }
          } catch (e) {
            // Silence getTotalLength check errors on non-geometry elements
          }
        })
      })
      .catch(() => {
        setMermaidFailed(true)
        if (mermaidRef.current) mermaidRef.current.innerHTML = ''
      })
  }, [arch.mermaid_diagram, arch.id])

  return (
    <div
      className="relative bg-paper border flex flex-col justify-between rounded-sm overflow-hidden"
      style={{
        borderColor: isRecommended ? '#B8472E' : '#C9C2AE',
        borderWidth: isRecommended ? '2px' : '1px',
      }}
    >
      {/* Decisive annotation red stamp for recommended winner */}
      {isRecommended && (
        <div className="absolute top-4 right-4 z-10 recommendation-stamp select-none pointer-events-none">
          <div className="border-2 border-dashed border-annotation text-annotation font-mono font-black text-[10px] tracking-widest px-3 py-1 bg-paper/95 uppercase rotate-[-3deg]">
            RECOMMENDED BY AI
          </div>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 text-blueprint">
            <span className="flex-shrink-0">{ARCH_ICONS[arch.arch_type]}</span>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
              {ARCH_LABEL_MAP[arch.arch_type] ?? arch.arch_type.toUpperCase()}
            </span>
          </div>

          {/* Explanation */}
          <p className="text-ink text-xs uppercase leading-relaxed mb-4 font-mono font-medium opacity-85">
            {arch.explanation}
          </p>

          {/* Drawing area for Mermaid diagram */}
          <div className="bg-paper border border-hairline rounded-sm p-3 mb-4 overflow-auto min-h-[140px] flex items-center justify-center mermaid-container">
            {mermaidFailed ? (
              <pre className="code-block text-graphite whitespace-pre-wrap break-all text-[9px] uppercase font-mono leading-normal">
                {arch.mermaid_diagram}
              </pre>
            ) : (
              <div className="w-full" ref={mermaidRef} />
            )}
          </div>
        </div>

        <div>
          {/* Pros / Cons Trade-off table */}
          {arch.tradeoffs && (
            <div className="grid grid-cols-2 gap-3 mb-4 border-t border-hairline pt-3 text-left">
              <div className="font-mono">
                <p className="text-[9px] font-bold tracking-wider uppercase text-blueprint mb-1.5">[ PROS ]</p>
                <ul className="space-y-1">
                  {arch.tradeoffs.pros.map((p, i) => (
                    <li key={i} className="text-[10px] text-graphite leading-relaxed uppercase flex items-start gap-1">
                      <span className="text-blueprint font-bold">·</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="font-mono">
                <p className="text-[9px] font-bold tracking-wider uppercase text-annotation mb-1.5">[ CONS ]</p>
                <ul className="space-y-1">
                  {arch.tradeoffs.cons.map((c, i) => (
                    <li key={i} className="text-[10px] text-graphite leading-relaxed uppercase flex items-start gap-1">
                      <span className="text-annotation font-bold">·</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Docker Compose panel */}
          {arch.docker_compose && (
            <div className="border border-hairline rounded-sm overflow-hidden font-mono mt-3">
              <button
                onClick={() => setDockerOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-graphite hover:text-ink hover:bg-hairline/20 transition-colors duration-100"
              >
                <span className="font-bold tracking-wider uppercase">DOCKER-COMPOSE.YML</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={arch.docker_compose} />
                  <span className="text-[9px] transition-transform duration-100" style={{ transform: dockerOpen ? 'rotate(180deg)' : 'none' }}>
                    ▾
                  </span>
                </div>
              </button>
              {dockerOpen && (
                <pre className="code-block bg-paper text-ink px-4 py-3 overflow-auto max-h-64 text-[10px] border-t border-hairline text-left leading-normal whitespace-pre">
                  {arch.docker_compose}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="px-5 py-2 border-t border-hairline bg-hairline/10 font-mono text-[9px] text-graphite flex justify-between uppercase">
        <span>ENGINE: {arch.llm_provider}</span>
        <span>SPEC BLOCK: #{arch.id}</span>
      </div>
    </div>
  )
}
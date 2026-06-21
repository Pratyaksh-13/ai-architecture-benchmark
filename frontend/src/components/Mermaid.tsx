import { useEffect, useRef, useState } from "react";

let mermaidMod: any = null;
let initialized = false;
async function getMermaid() {
  if (!mermaidMod) {
    mermaidMod = (await import("mermaid")).default;
  }
  if (initialized) return mermaidMod;
  initialized = true;
  mermaidMod.initialize({
    startOnLoad: false,
    theme: "base",
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    themeVariables: {
      background: "#F2EFE6",
      primaryColor: "#F2EFE6",
      primaryTextColor: "#1B2330",
      primaryBorderColor: "#2952A3",
      lineColor: "#2952A3",
      secondaryColor: "#E8E3D2",
      tertiaryColor: "#F2EFE6",
      tertiaryTextColor: "#1B2330",
      mainBkg: "#F2EFE6",
      nodeBorder: "#2952A3",
      clusterBkg: "#EFEAD8",
      clusterBorder: "#C9C2AE",
      edgeLabelBackground: "#F2EFE6",
      textColor: "#1B2330",
    },
    flowchart: { curve: "linear", htmlLabels: true },
    sequence: { actorFontFamily: "JetBrains Mono", noteFontFamily: "JetBrains Mono", messageFontFamily: "JetBrains Mono" },
  });
  return mermaidMod;
}

let counter = 0;

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mmd-${++counter}-${Date.now()}`;
    (async () => {
      try {
        const m = await getMermaid();
        const { svg } = await m.render(id, chart);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        // Animate strokes
        const paths = ref.current.querySelectorAll<SVGPathElement>("path.flowchart-link, .messageLine0, .messageLine1, path.edge-thickness-normal");
        paths.forEach((p, i) => {
          try {
            const len = p.getTotalLength();
            p.style.strokeDasharray = `${len}`;
            p.style.strokeDashoffset = `${len}`;
            p.style.setProperty("--draw-len", `${len}`);
            p.style.animation = `draw-in ${600 + i * 60}ms ease-out ${i * 50}ms forwards`;
          } catch {}
        });
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to render diagram");
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  if (err) {
    return (
      <div className="hairline p-4 bg-secondary">
        <div className="label-anno mb-2">DIAGRAM RENDER FAILED</div>
        <pre className="text-xs font-mono whitespace-pre-wrap text-graphite overflow-auto max-h-64" style={{ color: "var(--graphite)" }}>{chart}</pre>
      </div>
    );
  }
  return <div ref={ref} className="mermaid-host w-full overflow-x-auto" />;
}
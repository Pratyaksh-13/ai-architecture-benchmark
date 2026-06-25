import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Protected } from "@/components/Shell";
import { ProjectTabs } from "@/components/ProjectTabs";
import {
  projects as projectsApi,
  ApiError,
  type Architecture,
  type Benchmark,
} from "@/lib/api";
import { ARCH_META, AXIS_STYLE, TOOLTIP_STYLE, LEGEND_STYLE, downloadMarkdown, downloadPdf } from "@/lib/project-utils";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

export const Route = createFileRoute("/projects/$id/summary")({
  head: () => ({ meta: [{ title: "Executive Summary — ArchBench" }] }),
  ssr: false,
  component: ExecutiveSummary,  
});
function ExecutiveSummary() {
  const { id } = Route.useParams();
  const pid = Number(id);
  const [dlMd, setDlMd] = useState(false);
  const [dlPdf, setDlPdf] = useState(false);

  const projectQ = useQuery({ queryKey: ["project", pid], queryFn: () => projectsApi.get(pid) });
  const archQ    = useQuery({ queryKey: ["arch", pid],    queryFn: () => projectsApi.architectures(pid) });
  const benchQ   = useQuery({ queryKey: ["bench", pid],   queryFn: () => projectsApi.benchmarks(pid) });
  const recQ     = useQuery({
    queryKey: ["rec", pid],
    queryFn: async () => {
      try { return await projectsApi.recommendation(pid); }
      catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
    },
  });

  if (projectQ.isLoading) return <div className="p-10 label-anno">LOADING…</div>;
  if (projectQ.error) return <div className="p-10" style={{ color: "var(--annotation)" }}>{(projectQ.error as Error).message}</div>;

  const project = projectQ.data!;
  const archs   = archQ.data  ?? [];
  const benches = benchQ.data ?? [];
  const rec     = recQ.data;

  const recArch    = archs.find((a) => a.arch_type === rec?.recommended_arch_type);
  const benchWinner = benches.length > 0
    ? archs.find((a) => {
        const best = [...archs].sort((x, y) => {
          const bx = benches.find((b) => b.architecture_id === x.id);
          const by = benches.find((b) => b.architecture_id === y.id);
          return (bx?.latency_p95_ms ?? 999999) - (by?.latency_p95_ms ?? 999999);
        })[0];
        return a.id === best?.id;
      })
    : null;

  // Fitness score = inverse of normalised p95 latency (simple proxy)
  const fitnessData = archs.map((a) => {
  const b = benches.find((x) => x.architecture_id === a.id);
  const allRps = benches.map((x) => x.throughput_rps);
  const allLat = benches.map((x) => x.latency_p95_ms);
  const maxRps = allRps.length > 0 ? Math.max(...allRps) : 1;
  const minLat = allLat.length > 0 ? Math.min(...allLat) : 1;
  const rpsScore = b ? (b.throughput_rps / maxRps) * 100 : 0;
  const latScore = b ? (minLat / b.latency_p95_ms) * 100 : 0;
  const errScore = b ? Math.max(0, 100 - b.error_rate_pct * 10) : 0;
  const fitness  = b ? Math.round((rpsScore + latScore + errScore) / 3 * 10) / 10 : 0;
  return { name: ARCH_META[a.arch_type]?.title ?? a.arch_type, fitness, arch: a };
});

  const latencyData = archs.map((a) => {
    const b = benches.find((x) => x.architecture_id === a.id);
    return {
      name: ARCH_META[a.arch_type]?.title ?? a.arch_type,
      p50: b?.latency_p50_ms ?? 0,
      p95: b?.latency_p95_ms ?? 0,
      p99: b?.latency_p99_ms ?? 0,
      rps: b?.throughput_rps ?? 0,
    };
  });

  const radarData = ["Latency", "Throughput", "Error Rate", "CPU", "Memory"].map((metric) => {
    const entry: Record<string, any> = { metric };
    archs.forEach((a) => {
      const b = benches.find((x) => x.architecture_id === a.id);
      const name = ARCH_META[a.arch_type]?.title ?? a.arch_type;
      if (!b) { entry[name] = 0; return; }
      if (metric === "Latency")    entry[name] = Math.max(0, 100 - b.latency_p95_ms / 10);
      if (metric === "Throughput") entry[name] = Math.min(100, b.throughput_rps / 10);
      if (metric === "Error Rate") entry[name] = Math.max(0, 100 - b.error_rate_pct * 20);
      if (metric === "CPU")        entry[name] = Math.max(0, 100 - b.cpu_usage_pct);
      if (metric === "Memory")     entry[name] = Math.max(0, 100 - b.memory_usage_mb / 20);
    });
    return entry;
  });

  const RADAR_COLORS = ["#2952A3", "#6B6558", "#B8472E"];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/" className="label-anno hover:text-ink">← BACK TO ARCHIVE</Link>

      <div className="mt-4 pb-0">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="label-anno">PROJECT #{String(project.id).padStart(4, "0")} · EXECUTIVE SUMMARY</div>
            <h1 className="text-3xl mt-2" style={{ fontFamily: "var(--font-display)" }}>{project.requirement}</h1>
          </div>
          <div className="flex items-center gap-2 mt-6 shrink-0">
            <button disabled={dlMd} onClick={async () => { setDlMd(true); await downloadMarkdown(pid).catch(() => {}); setDlMd(false); }} className="ghost-btn disabled:opacity-50">
              {dlMd ? "…" : "↓ MARKDOWN"}
            </button>
            <button disabled={dlPdf} onClick={async () => { setDlPdf(true); await downloadPdf(pid).catch(() => {}); setDlPdf(false); }} className="ghost-btn disabled:opacity-50">
              {dlPdf ? "…" : "↓ PDF"}
            </button>
          </div>
        </div>
        <ProjectTabs id={id} />
      </div>

      {/* ── RECOMMENDED ARCHITECTURE ── */}
      {rec ? (
  <section className="mt-10 hairline p-6 relative" style={{ borderColor: "var(--annotation)", backgroundColor: "rgba(184,71,46,0.04)" }}>
    <div className="label-anno mb-1" style={{ color: "var(--annotation)" }}>RECOMMENDED ARCHITECTURE</div>
    <h2 className="text-2xl mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--annotation)" }}>
      {ARCH_META[rec.recommended_arch_type]?.title ?? rec.recommended_arch_type}
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ backgroundColor: "var(--hairline)" }}>
      <StatBox label="CONFIDENCE" value={`${(rec.confidence_score * 100).toFixed(0)}%`} />
      <StatBox label="BENCHMARK WINNER" value={benchWinner ? (ARCH_META[benchWinner.arch_type]?.title ?? benchWinner.arch_type) : "—"} />
      <StatBox
        label="FITNESS SCORE"
        value={(() => {
          const f = fitnessData.find((f) => f.arch.arch_type === rec.recommended_arch_type)?.fitness;
          return f != null && f > 0 ? `${f}/100` : "—";
        })()}
      />
    </div>
  </section>
) : (
  <section className="mt-10 hairline p-6" style={{ backgroundColor: "var(--paper)", color: "var(--graphite)" }}>
    <div className="label-anno">NO RECOMMENDATION YET · RUN A BENCHMARK AND GET REVIEWER VERDICT FIRST</div>
  </section>
)}

      {/* ── ARCHITECTURE DECISION PROCESS ── */}
      {rec && (
        <section className="mt-10">
          <div className="label-anno mb-4">ARCHITECTURE DECISION PROCESS</div>
          <div className="hairline p-6" style={{ backgroundColor: "var(--paper)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{rec.reasoning}</p>
            <div className="label-anno mt-3" style={{ color: "var(--graphite)" }}>SIGNED · {rec.llm_provider.toUpperCase()}</div>
          </div>
        </section>
      )}

      {/* ── REQUIREMENT SIGNALS ── */}
      <section className="mt-10">
        <div className="label-anno mb-4">REQUIREMENT SIGNALS</div>
        <div className="hairline p-6" style={{ backgroundColor: "var(--paper)" }}>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{project.requirement}</p>
        </div>
      </section>

      {/* ── ARCHITECTURE COMPARISON CARDS ── */}
      <section className="mt-10">
        <div className="label-anno mb-4">ARCHITECTURE COMPARISON</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ backgroundColor: "var(--hairline)" }}>
          {archs.map((a) => {
            const meta = ARCH_META[a.arch_type] ?? { title: a.arch_type, num: "—" };
            const isRec = rec?.recommended_arch_type === a.arch_type;
            return (
              <div key={a.id} className="p-5" style={{ backgroundColor: "var(--paper)", position: "relative" }}>
                {isRec && (
                  <div className="label-anno mb-2 px-2 py-1 inline-block" style={{ color: "var(--annotation)", border: "1px solid var(--annotation)", fontSize: "0.6rem" }}>
                    ★ RECOMMENDED
                  </div>
                )}
                <div className="label-anno mb-1" style={{ color: "var(--graphite)" }}>ARCHITECTURE {meta.num}</div>
                <div className="text-lg mb-3" style={{ fontFamily: "var(--font-display)" }}>{meta.title}</div>
                {a.tradeoffs && (
                  <>
                    <div className="label-anno mb-1" style={{ color: "var(--blueprint)", fontSize: "0.6rem" }}>PROS</div>
                    <ul className="text-xs mb-3 space-y-1">
                      {a.tradeoffs.pros.slice(0, 3).map((p, i) => <li key={i}>+ {p}</li>)}
                    </ul>
                    <div className="label-anno mb-1" style={{ color: "var(--annotation)", fontSize: "0.6rem" }}>CONS</div>
                    <ul className="text-xs space-y-1">
                      {a.tradeoffs.cons.slice(0, 3).map((c, i) => <li key={i}>− {c}</li>)}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FITNESS COMPARISON CHART ── */}
      {benches.length > 0 && (
        <section className="mt-10">
          <div className="label-anno mb-4">FITNESS COMPARISON</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px" style={{ backgroundColor: "var(--hairline)" }}>
            <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
              <div className="label-anno mb-2">FITNESS SCORE · /100</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={fitnessData}>
                  <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
                  <XAxis dataKey="name" tick={AXIS_STYLE} stroke="#6B6558" />
                  <YAxis domain={[0, 100]} tick={AXIS_STYLE} stroke="#6B6558" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="fitness" fill="#2952A3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
              <div className="label-anno mb-2">MULTI-AXIS COMPARISON</div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#C9C2AE" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontFamily: "JetBrains Mono", fontSize: 10, fill: "#6B6558" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {archs.map((a, i) => (
                    <Radar
                      key={a.id}
                      name={ARCH_META[a.arch_type]?.title ?? a.arch_type}
                      dataKey={ARCH_META[a.arch_type]?.title ?? a.arch_type}
                      stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* ── BENCHMARK RESULTS CHART ── */}
      {benches.length > 0 && (
        <section className="mt-10">
          <div className="label-anno mb-4">BENCHMARK RESULTS · {benches[0]?.load_profile.toUpperCase()} LOAD</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px" style={{ backgroundColor: "var(--hairline)" }}>
            <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
              <div className="label-anno mb-2">LATENCY · MS</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={latencyData}>
                  <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
                  <XAxis dataKey="name" tick={AXIS_STYLE} stroke="#6B6558" />
                  <YAxis tick={AXIS_STYLE} stroke="#6B6558" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  <Bar dataKey="p50" fill="#2952A3" />
                  <Bar dataKey="p95" fill="#6B6558" />
                  <Bar dataKey="p99" fill="#B8472E" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
              <div className="label-anno mb-2">THROUGHPUT · RPS</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={latencyData}>
                  <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
                  <XAxis dataKey="name" tick={AXIS_STYLE} stroke="#6B6558" />
                  <YAxis tick={AXIS_STYLE} stroke="#6B6558" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="rps" fill="#2952A3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* ── TRADE-OFF EXPLANATION ── */}
      <section className="mt-10">
        <div className="label-anno mb-4">TRADE-OFF EXPLANATION</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ backgroundColor: "var(--hairline)" }}>
          {archs.map((a) => {
            const meta = ARCH_META[a.arch_type] ?? { title: a.arch_type, num: "—" };
            return (
              <div key={a.id} className="p-5" style={{ backgroundColor: "var(--paper)" }}>
                <div className="label-anno mb-2">{meta.title.toUpperCase()}</div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{a.explanation}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── PRODUCTION RECOMMENDATION ── */}
      {rec && recArch && (
        <section className="mt-10 hairline p-6" style={{ borderColor: "var(--annotation)", backgroundColor: "rgba(184,71,46,0.04)" }}>
          <div className="label-anno mb-2" style={{ color: "var(--annotation)" }}>PRODUCTION RECOMMENDATION</div>
          <h3 className="text-xl mb-3" style={{ fontFamily: "var(--font-display)" }}>
            Deploy {ARCH_META[rec.recommended_arch_type]?.title ?? rec.recommended_arch_type}
          </h3>
          {recArch.tradeoffs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px mb-4" style={{ backgroundColor: "var(--hairline)" }}>
              <div className="p-4" style={{ backgroundColor: "rgba(184,71,46,0.04)" }}>
                <div className="label-anno mb-2" style={{ color: "var(--blueprint)", fontSize: "0.6rem" }}>KEY STRENGTHS</div>
                <ul className="text-sm space-y-1">
                  {recArch.tradeoffs.pros.map((p, i) => <li key={i}>+ {p}</li>)}
                </ul>
              </div>
              <div className="p-4" style={{ backgroundColor: "rgba(184,71,46,0.04)" }}>
                <div className="label-anno mb-2" style={{ color: "var(--annotation)", fontSize: "0.6rem" }}>KNOWN RISKS</div>
                <ul className="text-sm space-y-1">
                  {recArch.tradeoffs.cons.map((c, i) => <li key={i}>− {c}</li>)}
                </ul>
              </div>
            </div>
          )}
          <p className="text-sm" style={{ color: "var(--ink)" }}>{rec.reasoning}</p>
        </section>
      )}

      {/* ── DOWNLOAD ── */}
      <section className="mt-10 hairline p-6 flex items-center justify-between flex-wrap gap-4" style={{ backgroundColor: "var(--paper)" }}>
        <div>
          <div className="label-anno mb-1">DOWNLOAD FULL REPORT</div>
          <p className="text-sm" style={{ color: "var(--graphite)" }}>Export this analysis as Markdown or PDF</p>
        </div>
        <div className="flex gap-2">
          <button disabled={dlMd} onClick={async () => { setDlMd(true); await downloadMarkdown(pid).catch(() => {}); setDlMd(false); }} className="ghost-btn disabled:opacity-50">
            {dlMd ? "…" : "↓ MARKDOWN"}
          </button>
          <button disabled={dlPdf} onClick={async () => { setDlPdf(true); await downloadPdf(pid).catch(() => {}); setDlPdf(false); }} className="ghost-btn disabled:opacity-50">
            {dlPdf ? "…" : "↓ PDF"}
          </button>
        </div>
      </section>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-5" style={{ backgroundColor: "rgba(184,71,46,0.04)" }}>
      <div className="label-anno mb-1" style={{ color: "var(--annotation)", fontSize: "0.6rem" }}>{label}</div>
      <div className="text-2xl" style={{ fontFamily: "var(--font-mono)", color: "var(--annotation)" }}>{value}</div>
    </div>
  );
}
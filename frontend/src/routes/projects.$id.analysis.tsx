import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ProjectTabs } from "@/components/ProjectTabs";
import {
  projects as projectsApi,
  ApiError,
  type Architecture,
  type BottleneckFinding,
  type CapacityProjection,
  type CostEstimate,
  type OptimizationRecommendation,
  type EvolutionStep,
  type AnalysisResult,
} from "@/lib/api";
import {
  ARCH_META,
  AXIS_STYLE,
  TOOLTIP_STYLE,
  LEGEND_STYLE,
  SEVERITY_COLOR,
  relativeTime,
  downloadMarkdown,
  downloadPdf,
} from "@/lib/project-utils";
import { CountUp } from "@/components/CountUp";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export const Route = createFileRoute("/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "Analysis — ArchBench" }] }),
  ssr: false,
  component: () => <ProjectAnalysis />,
});

// ═══════════════════════════════════════════════════════════════════════════════
// Analysis page
// ═══════════════════════════════════════════════════════════════════════════════
function ProjectAnalysis() {
  const { id } = Route.useParams();
  const pid = Number(id);
  const qc  = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const projectQ = useQuery({ queryKey: ["project", pid], queryFn: () => projectsApi.get(pid) });
  const archQ    = useQuery({ queryKey: ["arch", pid],    queryFn: () => projectsApi.architectures(pid) });
  const benchQ   = useQuery({ queryKey: ["bench", pid],   queryFn: () => projectsApi.benchmarks(pid) });

  const bottleneckQ = useQuery({
    queryKey: ["bottlenecks", pid],
    queryFn: async () => { try { return await projectsApi.bottlenecks(pid); } catch { return []; } },
  });
  const optimQ = useQuery({
    queryKey: ["optimizations", pid],
    queryFn: async () => { try { return await projectsApi.optimizations(pid); } catch { return []; } },
  });
  const costsQ = useQuery({
    queryKey: ["costs", pid],
    queryFn: async () => { try { return await projectsApi.costs(pid); } catch { return []; } },
  });
  // CHANGE 5 — auto-fetch capacity on page load
  const capacityQ = useQuery({
    queryKey: ["capacity", pid],
    queryFn: async () => { try { return await projectsApi.capacityGet(pid); } catch { return []; } },
  });
  const evolutionQ = useQuery({
    queryKey: ["evolution", pid],
    queryFn: async () => { try { return await projectsApi.evolution(pid); } catch { return []; } },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [dlMd, setDlMd] = useState(false);
  const [dlPdf, setDlPdf] = useState(false);

  const runAnalysis = useMutation({
    mutationFn: () => projectsApi.analyze(pid),
    onSuccess: (data) => {
      setAnalysisResult(data);
      qc.invalidateQueries({ queryKey: ["bottlenecks", pid] });
      qc.invalidateQueries({ queryKey: ["optimizations", pid] });
      qc.invalidateQueries({ queryKey: ["costs", pid] });
    },
  });

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (projectQ.isLoading) return <div className="p-10 label-anno">LOADING PROJECT…</div>;
  if (projectQ.error)     return <div className="p-10" style={{ color: "var(--annotation)" }}>{(projectQ.error as ApiError).message}</div>;

  const project       = projectQ.data!;
  const archs         = archQ.data        ?? [];
  const benches       = benchQ.data       ?? [];
  const bottlenecks   = bottleneckQ.data  ?? [];
  const optimizations = optimQ.data       ?? [];
  const costs         = costsQ.data       ?? [];
  const capacity      = capacityQ.data    ?? [];
  const timeline      = evolutionQ.data   ?? [];
  const hasBenches    = benches.length > 0;
  const hasV4Data     = bottlenecks.length > 0 || optimizations.length > 0 || costs.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/" className="label-anno hover:text-ink">← BACK TO ARCHIVE</Link>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mt-4 pb-0">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="label-anno">PROJECT #{String(project.id).padStart(4, "0")} · STATUS {project.status.toUpperCase()}</div>
            <h1 className="text-3xl mt-2" style={{ fontFamily: "var(--font-display)" }}>{project.requirement}</h1>
          </div>
          {/* Report download buttons */}
          <div className="flex items-center gap-2 mt-6 shrink-0">
            <button id="btn-download-md" disabled={dlMd}
              onClick={async () => { setDlMd(true); await downloadMarkdown(pid).catch(() => {}); setDlMd(false); }}
              className="ghost-btn disabled:opacity-50" title="Download Markdown report">
              {dlMd ? "…" : "↓ MARKDOWN"}
            </button>
            <button id="btn-download-pdf" disabled={dlPdf}
              onClick={async () => { setDlPdf(true); await downloadPdf(pid).catch(() => {}); setDlPdf(false); }}
              className="ghost-btn disabled:opacity-50" title="Download PDF report">
              {dlPdf ? "…" : "↓ PDF"}
            </button>
          </div>
        </div>
        <ProjectTabs id={id} />
      </div>

      {/* ── 1. Analysis trigger ──────────────────────────────────────────── */}
      <AnalysisSection
        pid={pid}
        hasBenches={hasBenches}
        isPending={runAnalysis.isPending}
        result={analysisResult ?? (hasV4Data ? {
          bottleneck_count: bottlenecks.length,
          optimization_count: optimizations.length,
          cost_estimate_count: costs.length,
          status: "complete",
        } : null)}
        onRun={() => runAnalysis.mutate()}
        error={runAnalysis.error as Error | null}
      />

      {/* ── 2. Bottleneck findings ───────────────────────────────────────── */}
      <BottleneckSection archs={archs} findings={bottlenecks} />

      {/* ── 3. Optimization recommendations ─────────────────────────────── */}
      <OptimizationSection recommendations={optimizations} />

      {/* ── 4. Cost estimates ────────────────────────────────────────────── */}
      <CostSection archs={archs} estimates={costs} />

      {/* ── 5. Capacity planning (CHANGE 5 — restored from GET on load) ─── */}
      <CapacitySection pid={pid} archs={archs} projections={capacity} />

      {/* ── 6. Evolution timeline ────────────────────────────────────────── */}
      <EvolutionSection timeline={timeline} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Analysis trigger
// ═══════════════════════════════════════════════════════════════════════════════
function AnalysisSection({ hasBenches, isPending, result, onRun, error }: {
  pid: number; hasBenches: boolean; isPending: boolean;
  result: AnalysisResult | null; onRun: () => void; error: Error | null;
}) {
  return (
    <section className="mt-10">
      <div className="label-anno mb-4">V4 ANALYSIS · DEEP SCAN</div>
      <div className="hairline p-6" style={{ backgroundColor: "var(--paper)" }}>
        <p className="text-sm mb-4" style={{ color: "var(--graphite)" }}>
          {hasBenches
            ? "Benchmarks on file. Run the V4 engine to detect bottlenecks, model costs, and generate optimisation recommendations."
            : "Run a benchmark first — V4 analysis requires measured performance data."}
        </p>
        <button id="btn-run-analysis" disabled={!hasBenches || isPending} onClick={onRun} className="blueprint-btn disabled:opacity-40">
          {isPending ? "Analysing…" : "Run V4 Analysis"}
        </button>
        {error && <div className="mt-2 text-xs" style={{ color: "var(--annotation)" }}>{error.message}</div>}
        {result && (
          <div className="mt-5 flex flex-wrap gap-4">
            {([
              { label: "BOTTLENECKS",    val: result.bottleneck_count },
              { label: "OPTIMISATIONS",  val: result.optimization_count },
              { label: "COST ESTIMATES", val: result.cost_estimate_count },
            ] as const).map(({ label, val }) => (
              <div key={label} className="hairline px-4 py-3 flex flex-col items-center gap-1">
                <span className="label-anno" style={{ color: "var(--graphite)" }}>{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>
                  <CountUp value={val} decimals={0} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Bottleneck findings
// ═══════════════════════════════════════════════════════════════════════════════
function SeverityBadge({ severity }: { severity: BottleneckFinding["severity"] }) {
  return (
    <span className="label-anno px-2 py-0.5" style={{ border: `1px solid ${SEVERITY_COLOR[severity]}`, color: SEVERITY_COLOR[severity] }}>
      {severity.toUpperCase()}
    </span>
  );
}

function BottleneckCard({ finding }: { finding: BottleneckFinding }) {
  return (
    <div className="p-4 mb-3 last:mb-0"
      style={{ borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity]}`, backgroundColor: "var(--secondary)" }}>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <SeverityBadge severity={finding.severity} />
        <span className="label-anno" style={{ color: "var(--ink)" }}>
          {finding.bottleneck_type.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      {finding.evidence.length > 0 && (
        <ul className="text-xs mb-2 space-y-0.5 pl-2" style={{ color: "var(--graphite)", fontFamily: "var(--font-mono)" }}>
          {finding.evidence.map((e, i) => <li key={i}>· {e}</li>)}
        </ul>
      )}
      {finding.recommendation && <p className="text-sm mt-2" style={{ color: "var(--graphite)" }}>{finding.recommendation}</p>}
    </div>
  );
}

function BottleneckSection({ archs, findings }: { archs: Architecture[]; findings: BottleneckFinding[] }) {
  const archName = (id: number) => {
    const a = archs.find((x) => x.id === id);
    return a ? (ARCH_META[a.arch_type]?.title ?? a.arch_type) : `Architecture ${id}`;
  };
  const groups = findings.reduce<Record<number, BottleneckFinding[]>>((acc, f) => {
    (acc[f.architecture_id] ??= []).push(f); return acc;
  }, {});
  return (
    <section className="mt-10">
      <details open={findings.length > 0} className="hairline" style={{ backgroundColor: "var(--paper)" }}>
        <summary className="p-4 cursor-pointer flex items-center justify-between select-none" style={{ listStyle: "none" }}>
          <span className="label-anno">BOTTLENECK FINDINGS · {findings.length} ISSUE{findings.length !== 1 ? "S" : ""}</span>
          <span className="label-anno" style={{ color: "var(--blueprint)" }}>▾</span>
        </summary>
        <div className="border-t" style={{ borderColor: "var(--hairline)" }}>
          {findings.length === 0 ? (
            <div className="p-6 label-anno" style={{ color: "var(--graphite)" }}>NO FINDINGS YET · RUN V4 ANALYSIS</div>
          ) : (
            Object.entries(groups).map(([archId, group]) => (
              <div key={archId} className="border-b last:border-0" style={{ borderColor: "var(--hairline)" }}>
                <div className="px-4 pt-3 pb-1 label-anno" style={{ color: "var(--blueprint)" }}>
                  {archName(Number(archId)).toUpperCase()}
                </div>
                <div className="px-4 pb-4">
                  {group
                    .sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] ?? 9) - ({ critical: 0, high: 1, medium: 2, low: 3 }[b.severity] ?? 9))
                    .map((f) => <BottleneckCard key={f.id} finding={f} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Optimization recommendations
// ═══════════════════════════════════════════════════════════════════════════════
function OptimizationCard({ rec }: { rec: OptimizationRecommendation }) {
  const isHigh = rec.priority === "high";
  const isMed  = rec.priority === "medium";
  const borderColor = isHigh ? "var(--annotation)" : isMed ? "var(--blueprint)" : "var(--hairline)";
  return (
    <div className="p-4 mb-3 last:mb-0 relative"
      style={{ borderLeft: `3px solid ${borderColor}`, backgroundColor: "var(--secondary)" }}>
      {isHigh && (
        <div className="absolute -top-2 -right-2 label-anno px-2 py-0.5 animate-stamp"
          style={{ border: "1px solid var(--annotation)", color: "var(--annotation)", backgroundColor: "var(--paper)", transform: "rotate(-2deg)", fontSize: "0.5625rem", letterSpacing: "0.2em" }}>
          ✦ ACTIONABLE
        </div>
      )}
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="label-anno" style={{ color: borderColor }}>{rec.priority.toUpperCase()}</span>
        <span className="label-anno" style={{ color: "var(--graphite)" }}>{rec.recommendation_type.replace(/_/g, " ").toUpperCase()}</span>
      </div>
      <h4 className="text-base mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{rec.title}</h4>
      <p className="text-sm mb-2" style={{ color: "var(--graphite)" }}>{rec.description}</p>
      {rec.expected_improvement && (
        <div className="label-anno" style={{ color: "var(--blueprint)" }}>EXPECTED: {rec.expected_improvement}</div>
      )}
    </div>
  );
}

function OptimizationSection({ recommendations }: { recommendations: OptimizationRecommendation[] }) {
  const sorted = [...recommendations].sort(
    (a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 9) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 9),
  );
  return (
    <section className="mt-10">
      <div className="label-anno mb-4">OPTIMISATION RECOMMENDATIONS · {recommendations.length}</div>
      <div className="hairline" style={{ backgroundColor: "var(--paper)" }}>
        {sorted.length === 0 ? (
          <div className="p-6 label-anno" style={{ color: "var(--graphite)" }}>NO RECOMMENDATIONS YET · RUN V4 ANALYSIS</div>
        ) : (
          <div className="p-4">{sorted.map((r) => <OptimizationCard key={r.id} rec={r} />)}</div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Cost estimates — CHANGE 6: dynamic cheapest column
// ═══════════════════════════════════════════════════════════════════════════════
const PROVIDERS: CostEstimate["provider"][] = ["aws", "gcp", "azure"];
const PROVIDER_LABELS: Record<string, string> = { aws: "AWS", gcp: "GCP", azure: "AZURE" };
const COST_COLORS = {
  compute: "#2952A3",
  memory:  "#4A7AB8",
  storage: "#6B6558",
  redis:   "#B8472E",
  postgres:"#9A8A3A",
};

function CostTable({ archs, estimates }: { archs: Architecture[]; estimates: CostEstimate[] }) {
  const byArchProvider: Record<number, Record<string, CostEstimate>> = {};
  for (const e of estimates) { (byArchProvider[e.architecture_id] ??= {})[e.provider] = e; }
  const archIds = [...new Set(estimates.map((e) => e.architecture_id))];

  return (
    <div className="hairline overflow-x-auto" style={{ backgroundColor: "var(--paper)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--hairline)" }}>
            <th className="text-left p-3 label-anno">ARCHITECTURE</th>
            {PROVIDERS.map((p) => <th key={p} className="text-right p-3 label-anno">{PROVIDER_LABELS[p]}</th>)}
            <th className="text-right p-3 label-anno" style={{ color: "var(--blueprint)" }}>CHEAPEST</th>
          </tr>
        </thead>
        <tbody>
          {archIds.map((archId) => {
            const arch = archs.find((a) => a.id === archId);
            const name = arch ? (ARCH_META[arch.arch_type]?.title ?? arch.arch_type) : `Arch ${archId}`;
            const row  = byArchProvider[archId] ?? {};

            // Dynamically find cheapest provider
            let cheapestProvider: string | null = null;
            let cheapestUsd = Infinity;
            for (const p of PROVIDERS) {
              const e = row[p];
              if (e && e.estimated_monthly_usd < cheapestUsd) {
                cheapestUsd = e.estimated_monthly_usd;
                cheapestProvider = p;
              }
            }

            return (
              <tr key={archId} className="border-b last:border-0" style={{ borderColor: "var(--hairline)" }}>
                <td className="p-3 label-anno" style={{ color: "var(--ink)" }}>{name.toUpperCase()}</td>
                {PROVIDERS.map((p) => {
                  const e         = row[p];
                  const isCheapest = p === cheapestProvider;
                  return (
                    <td key={p} className="p-3 text-right"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: isCheapest ? 700 : 400,
                        backgroundColor: isCheapest ? "rgba(41,82,163,0.07)" : "transparent",
                        color: isCheapest ? "var(--blueprint)" : "var(--ink)",
                        borderLeft: isCheapest ? "2px solid var(--blueprint)" : undefined,
                      }}>
                      {e ? `$${e.estimated_monthly_usd.toFixed(2)}` : "—"}
                    </td>
                  );
                })}
                {/* CHEAPEST — dynamic: provider name + price, blueprint */}
                <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                  {cheapestProvider ? (
                    <span style={{ color: "var(--blueprint)", fontWeight: 700, border: "1px solid var(--blueprint)", padding: "1px 6px" }}>
                      {PROVIDER_LABELS[cheapestProvider]} · ${cheapestUsd.toFixed(2)}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CostBreakdownChart({ archs, estimates }: { archs: Architecture[]; estimates: CostEstimate[] }) {
  const data = estimates.map((e) => {
    const arch      = archs.find((a) => a.id === e.architecture_id);
    const archLabel = arch ? (ARCH_META[arch.arch_type]?.title ?? arch.arch_type) : `Arch ${e.architecture_id}`;
    return {
      name:    `${archLabel} / ${PROVIDER_LABELS[e.provider] ?? e.provider}`,
      compute: e.cost_breakdown.compute_usd,
      memory:  e.cost_breakdown.memory_usd,
      storage: e.cost_breakdown.storage_usd,
      redis:   e.cost_breakdown.redis_usd,
      postgres:e.cost_breakdown.postgres_usd,
    };
  });
  return (
    <div className="mt-4 p-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="label-anno mb-3">COST BREAKDOWN · USD / MONTH</div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 60, left: 8 }}>
          <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
          <XAxis dataKey="name" tick={{ ...AXIS_STYLE, angle: -35, textAnchor: "end" }} stroke="#6B6558" interval={0} />
          <YAxis tick={AXIS_STYLE} stroke="#6B6558" tickFormatter={(v: number) => `$${v}`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [`$${Number(value ?? 0).toFixed(2)}`, String(name).toUpperCase()]} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          {(Object.keys(COST_COLORS) as (keyof typeof COST_COLORS)[]).map((k) => (
            <Bar key={k} dataKey={k} stackId="cost" fill={COST_COLORS[k]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CostSection({ archs, estimates }: { archs: Architecture[]; estimates: CostEstimate[] }) {
  return (
    <section className="mt-10">
      <div className="label-anno mb-4">COST ESTIMATES · {estimates.length} PROJECTION{estimates.length !== 1 ? "S" : ""}</div>
      {estimates.length === 0 ? (
        <div className="hairline p-6 label-anno" style={{ backgroundColor: "var(--paper)", color: "var(--graphite)" }}>
          NO COST DATA YET · RUN V4 ANALYSIS
        </div>
      ) : (
        <div className="hairline" style={{ backgroundColor: "var(--paper)" }}>
          <CostTable archs={archs} estimates={estimates} />
          <CostBreakdownChart archs={archs} estimates={estimates} />
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Capacity planning — CHANGE 5: auto-restored from GET on mount
// ═══════════════════════════════════════════════════════════════════════════════
function CapacityCard({ proj, archs }: { proj: CapacityProjection; archs: Architecture[] }) {
  const arch  = archs.find((a) => a.id === proj.architecture_id);
  const name  = arch ? (ARCH_META[arch.arch_type]?.title ?? arch.arch_type) : `Architecture ${proj.architecture_id}`;
  return (
    <div className="hairline p-4 relative" style={{ backgroundColor: "var(--secondary)" }}>
      <div className="label-anno mb-2" style={{ color: "var(--blueprint)" }}>
        {name.toUpperCase()}{proj.growth_ratio != null ? ` · ${proj.growth_ratio.toFixed(1)}x GROWTH` : ""}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {proj.projected_latency_p95_ms != null && (
          <div>
            <div className="label-anno" style={{ color: "var(--graphite)" }}>PROJ. P95 LATENCY</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.125rem" }}>
              <CountUp value={proj.projected_latency_p95_ms} decimals={1} suffix=" ms" />
            </div>
          </div>
        )}
        {proj.projected_throughput_rps != null && (
          <div>
            <div className="label-anno" style={{ color: "var(--graphite)" }}>PROJ. THROUGHPUT</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.125rem" }}>
              <CountUp value={proj.projected_throughput_rps} decimals={0} suffix=" rps" />
            </div>
          </div>
        )}
      </div>
      {proj.scaling_recommendation && (
        <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>{proj.scaling_recommendation}</p>
      )}
      {proj.expected_bottlenecks.length > 0 && (
        <div className="mt-2 p-3" style={{ borderLeft: "2px solid var(--annotation)", backgroundColor: "rgba(184,71,46,0.06)" }}>
          <div className="label-anno mb-1" style={{ color: "var(--annotation)" }}>⚠ EXPECTED BOTTLENECKS</div>
          <ul className="text-xs space-y-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--annotation)" }}>
            {proj.expected_bottlenecks.map((b, i) => <li key={i}>· {b}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CapacitySection({ pid, archs, projections }: { pid: number; archs: Architecture[]; projections: CapacityProjection[] }) {
  const qc = useQueryClient();
  const [currentUsers,  setCurrentUsers]  = useState("");
  const [expectedUsers, setExpectedUsers] = useState("");

  const runCapacity = useMutation({
    mutationFn: () => projectsApi.capacityPost(pid, Number(currentUsers), Number(expectedUsers)),
    onSuccess: (data) => { qc.setQueryData(["capacity", pid], data); },
  });

  const latestRun = projections.length > 0
    ? [...projections].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
    : null;

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "0.875rem",
    backgroundColor: "var(--paper)", border: "1px solid var(--hairline)",
    padding: "0.5rem 0.75rem", color: "var(--ink)", width: "100%", outline: "none",
  };

  return (
    <section className="mt-10">
      <div className="label-anno mb-4">CAPACITY PLANNING · GROWTH PROJECTION</div>
      <div className="hairline p-6" style={{ backgroundColor: "var(--paper)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="label-anno mb-1">CURRENT USERS</div>
            <input id="capacity-current-users" type="number" min="1" placeholder="e.g. 10000"
              value={currentUsers} onChange={(e) => setCurrentUsers(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div className="label-anno mb-1">EXPECTED USERS</div>
            <input id="capacity-expected-users" type="number" min="1" placeholder="e.g. 100000"
              value={expectedUsers} onChange={(e) => setExpectedUsers(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button id="btn-project-capacity"
            disabled={runCapacity.isPending || !currentUsers || !expectedUsers}
            onClick={() => runCapacity.mutate()} className="blueprint-btn disabled:opacity-40">
            {runCapacity.isPending ? "Projecting…" : "Project capacity"}
          </button>
          {/* CHANGE 5 — "LAST PROJECTION" label from auto-fetched data */}
          {latestRun && (
            <span className="label-anno" style={{ color: "var(--graphite)" }}>
              LAST PROJECTION · {new Date(latestRun).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              &nbsp;({relativeTime(latestRun)})
            </span>
          )}
        </div>
        {runCapacity.error && (
          <div className="mt-2 text-xs" style={{ color: "var(--annotation)" }}>{(runCapacity.error as Error).message}</div>
        )}

        {/* Auto-restored or freshly computed results */}
        {projections.length > 0 && (
          <div className="mt-6">
            <div className="label-anno mb-3">
              CAPACITY PROJECTION ·{" "}
              {projections[0]?.growth_ratio != null
                ? `${projections[0].growth_ratio.toFixed(1)}x GROWTH`
                : `${projections[0]?.expected_users?.toLocaleString()} USERS`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {projections.map((p) => <CapacityCard key={p.id} proj={p} archs={archs} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Evolution timeline
// ═══════════════════════════════════════════════════════════════════════════════
function EvolutionSection({ timeline }: { timeline: EvolutionStep[] }) {
  return (
    <section className="mt-10 mb-4">
      <div className="label-anno mb-4">ARCHITECTURE EVOLUTION · TIMELINE</div>
      {timeline.length === 0 ? (
        <div className="hairline p-6 label-anno" style={{ backgroundColor: "var(--paper)", color: "var(--graphite)" }}>
          NO EVOLUTION HISTORY YET
        </div>
      ) : (
        <div className="hairline p-6 overflow-x-auto" style={{ backgroundColor: "var(--paper)" }}>
          <div className="flex items-center" style={{ minWidth: "max-content" }}>
            {timeline.map((step, i) => {
              const isLast    = i === timeline.length - 1;
              const archMeta  = ARCH_META[step.to_arch_type];
              const label     = archMeta?.title ?? step.to_arch_type;
              return (
                <div key={step.id} className="flex items-center">
                  {/* Step box */}
                  <div className="relative hairline p-4 flex flex-col gap-1"
                    style={{ minWidth: "140px", backgroundColor: isLast ? "rgba(184,71,46,0.05)" : "var(--secondary)", borderColor: isLast ? "var(--annotation)" : "var(--hairline)" }}>
                    {isLast && (
                      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full" style={{ backgroundColor: "var(--annotation)" }} />
                    )}
                    <div className="label-anno" style={{ color: isLast ? "var(--annotation)" : "var(--blueprint)" }}>
                      {label.toUpperCase()}
                    </div>
                    <div className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--graphite)" }}>
                      {new Date(step.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </div>
                    {step.trigger && (
                      <div className="text-xs mt-1" style={{ color: "var(--graphite)", maxWidth: "120px" }}>{step.trigger}</div>
                    )}
                  </div>
                  {/* 1px blueprint connector + arrowhead */}
                  {!isLast && (
                    <div className="flex items-center" style={{ width: "40px" }}>
                      <div style={{ flex: 1, height: "1px", backgroundColor: "var(--blueprint)" }} />
                      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ flexShrink: 0 }}>
                        <polyline points="0,0 8,6 0,12" stroke="#2952A3" strokeWidth="1.5" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

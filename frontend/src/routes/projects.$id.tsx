import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Protected } from "@/components/Shell";
import { projects as projectsApi, ApiError, type Architecture, type Benchmark } from "@/lib/api";
import { Mermaid } from "@/components/Mermaid";
import { CountUp } from "@/components/CountUp";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({ meta: [{ title: "Project — ArchBench" }] }),
  ssr:false,
  component: () => <Protected><ProjectDetail /></Protected>,
});

const ARCH_META: Record<string, { title: string; num: string }> = {
  monolithic: { title: "Monolithic", num: "01" },
  microservices: { title: "Microservices", num: "02" },
  event_driven: { title: "Event-driven", num: "03" },
};

function ProjectDetail() {
  const { id } = Route.useParams();
  const pid = Number(id);
  const qc = useQueryClient();

  const projectQ = useQuery({ queryKey: ["project", pid], queryFn: () => projectsApi.get(pid) });
  const archQ = useQuery({ queryKey: ["arch", pid], queryFn: () => projectsApi.architectures(pid) });
  const benchQ = useQuery({ queryKey: ["bench", pid], queryFn: () => projectsApi.benchmarks(pid) });
  const recQ = useQuery({
    queryKey: ["rec", pid],
    queryFn: async () => {
      try { return await projectsApi.recommendation(pid); }
      catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
    },
  });

  const [profile, setProfile] = useState<"light" | "medium" | "heavy">("medium");

  const runBench = useMutation({
    mutationFn: () => projectsApi.benchmark(pid, profile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bench", pid] }),
  });
  const runRec = useMutation({
    mutationFn: () => projectsApi.recommend(pid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rec", pid] }),
  });

  if (projectQ.isLoading) return <div className="p-10 label-anno">LOADING PROJECT…</div>;
  if (projectQ.error) return <div className="p-10" style={{ color: "var(--annotation)" }}>{(projectQ.error as Error).message}</div>;

  const project = projectQ.data!;
  const archs = archQ.data ?? [];
  const benches = benchQ.data ?? [];
  const rec = recQ.data;
  const hasBenches = benches.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/" className="label-anno hover:text-ink">← BACK TO ARCHIVE</Link>

      <div className="mt-4 border-b border-hairline pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="label-anno">PROJECT #{String(project.id).padStart(4, "0")} · STATUS {project.status.toUpperCase()}</div>
            <h1 className="text-3xl mt-2" style={{ fontFamily: "var(--font-display)" }}>{project.requirement}</h1>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline hairline mt-8" style={{ backgroundColor: "var(--hairline)" }}>
        <div className="bg-paper p-6" style={{ backgroundColor: "var(--paper)" }}>
          <div className="label-anno mb-3">LOAD PROFILE · BENCHMARK</div>
          <div className="flex gap-2 mb-4">
            {(["light", "medium", "heavy"] as const).map((p) => (
              <button key={p} onClick={() => setProfile(p)}
                className="label-anno border px-3 py-2"
                style={{
                  borderColor: profile === p ? "var(--ink)" : "var(--hairline)",
                  backgroundColor: profile === p ? "var(--ink)" : "transparent",
                  color: profile === p ? "var(--paper)" : "var(--ink)",
                }}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            disabled={runBench.isPending || archs.length === 0}
            onClick={() => runBench.mutate()}
            className="blueprint-btn disabled:opacity-50 w-full">
            {runBench.isPending ? "Running simulation…" : "Run benchmark"}
          </button>
          {runBench.error && <div className="mt-2 text-xs" style={{ color: "var(--annotation)" }}>{(runBench.error as Error).message}</div>}
        </div>

        <div className="bg-paper p-6" style={{ backgroundColor: "var(--paper)" }}>
          <div className="label-anno mb-3">REVIEWER VERDICT</div>
          <p className="text-sm mb-4" style={{ color: "var(--graphite)" }}>
            {hasBenches ? "Benchmarks on file. Ready for review." : "Run a benchmark first — verdicts require measured data."}
          </p>
          <button
            disabled={!hasBenches || runRec.isPending}
            onClick={() => runRec.mutate()}
            className="ink-btn disabled:opacity-40 w-full">
            {runRec.isPending ? "Reviewing…" : rec ? "Re-evaluate" : "Get recommendation"}
          </button>
          {runRec.error && <div className="mt-2 text-xs" style={{ color: "var(--annotation)" }}>{(runRec.error as Error).message}</div>}
        </div>
      </div>

      {/* Recommendation banner */}
      {rec && (
        <div className="mt-8 hairline p-6 relative" style={{ borderColor: "var(--annotation)", backgroundColor: "rgba(184,71,46,0.04)" }}>
          <div className="label-anno mb-2" style={{ color: "var(--annotation)" }}>REVIEWER NOTE · CONFIDENCE {(rec.confidence_score * 100).toFixed(0)}%</div>
          <h3 className="text-2xl mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--annotation)" }}>
            Recommended: {ARCH_META[rec.recommended_arch_type]?.title ?? rec.recommended_arch_type}
          </h3>
          <p className="text-sm" style={{ color: "var(--ink)" }}>{rec.reasoning}</p>
          <div className="label-anno mt-3" style={{ color: "var(--graphite)" }}>SIGNED · {rec.llm_provider.toUpperCase()}</div>
        </div>
      )}

      {/* Architectures */}
      <section className="mt-10">
        <div className="label-anno mb-4">ARCHITECTURES · {archs.length} / 3</div>
        {archQ.isLoading && <div className="label-anno">LOADING DRAWINGS…</div>}
        <div className="grid grid-cols-1 gap-6">
          {archs.map((a) => (
            <ArchCard key={a.id} arch={a} winner={rec?.recommended_arch_type === a.arch_type} />
          ))}
        </div>
      </section>

      {/* Benchmarks */}
      {hasBenches && (
        <section className="mt-12">
          <div className="label-anno mb-4">BENCHMARK RESULTS · {benches[0]?.load_profile.toUpperCase()} LOAD</div>
          <BenchmarkTable archs={archs} benches={benches} />
          <BenchmarkCharts archs={archs} benches={benches} />
        </section>
      )}
    </div>
  );
}

function ArchCard({ arch, winner }: { arch: Architecture; winner: boolean }) {
  const meta = ARCH_META[arch.arch_type] ?? { title: arch.arch_type, num: "—" };
  return (
    <article className="hairline p-6 relative" style={{ backgroundColor: "var(--paper)" }}>
      {winner && (
        <div
          className="absolute -top-3 -right-3 z-10 animate-stamp label-anno px-4 py-2"
          style={{
            border: "2px solid var(--annotation)",
            color: "var(--annotation)",
            backgroundColor: "var(--paper)",
            transform: "rotate(-3deg)",
            letterSpacing: "0.22em",
          }}>
          ★ RECOMMENDED
        </div>
      )}
      <div className="flex items-baseline justify-between border-b border-hairline pb-3 mb-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
          <span className="label-anno mr-3">ARCHITECTURE {meta.num}</span>{meta.title}
        </h2>
        <span className="label-anno" style={{ color: "var(--graphite)" }}>{arch.llm_provider}</span>
      </div>

      <div className="my-6 hairline p-4 bg-secondary overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <Mermaid chart={arch.mermaid_diagram} />
      </div>

      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--ink)" }}>{arch.explanation}</p>

      {arch.tradeoffs && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-hairline mt-4" style={{ backgroundColor: "var(--hairline)" }}>
          <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
            <div className="label-anno mb-2" style={{ color: "var(--blueprint)" }}>PROS</div>
            <ul className="text-sm space-y-1">
              {arch.tradeoffs.pros.map((p, i) => <li key={i}>+ {p}</li>)}
            </ul>
          </div>
          <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
            <div className="label-anno mb-2" style={{ color: "var(--annotation)" }}>CONS</div>
            <ul className="text-sm space-y-1">
              {arch.tradeoffs.cons.map((p, i) => <li key={i}>− {p}</li>)}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

function BenchmarkTable({ archs, benches }: { archs: Architecture[]; benches: Benchmark[] }) {
  const rows = [
    { k: "latency_p50_ms" as const, label: "Latency p50", suffix: " ms", d: 1 },
    { k: "latency_p95_ms" as const, label: "Latency p95", suffix: " ms", d: 1 },
    { k: "latency_p99_ms" as const, label: "Latency p99", suffix: " ms", d: 1 },
    { k: "throughput_rps" as const, label: "Throughput", suffix: " rps", d: 0 },
    { k: "error_rate_pct" as const, label: "Error rate", suffix: " %", d: 2 },
    { k: "cpu_usage_pct" as const, label: "CPU usage", suffix: " %", d: 1 },
    { k: "memory_usage_mb" as const, label: "Memory", suffix: " MB", d: 0 },
  ];
  const byArch = (id: number) => benches.find((b) => b.architecture_id === id);
  return (
    <div className="hairline overflow-x-auto" style={{ backgroundColor: "var(--paper)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline" style={{ borderColor: "var(--hairline)" }}>
            <th className="text-left p-3 label-anno">METRIC</th>
            {archs.map((a) => (
              <th key={a.id} className="text-right p-3 label-anno">{ARCH_META[a.arch_type]?.title ?? a.arch_type}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className="border-b border-hairline last:border-0" style={{ borderColor: "var(--hairline)" }}>
              <td className="p-3 label-anno" style={{ color: "var(--ink)" }}>{r.label}</td>
              {archs.map((a) => {
                const b = byArch(a.id);
                return (
                  <td key={a.id} className="p-3 text-right mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {b ? <CountUp value={b[r.k] as number} decimals={r.d} suffix={r.suffix} /> : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchmarkCharts({ archs, benches }: { archs: Architecture[]; benches: Benchmark[] }) {
  const data = archs.map((a) => {
    const b = benches.find((x) => x.architecture_id === a.id);
    return {
      name: ARCH_META[a.arch_type]?.title ?? a.arch_type,
      p50: b?.latency_p50_ms ?? 0,
      p95: b?.latency_p95_ms ?? 0,
      p99: b?.latency_p99_ms ?? 0,
      rps: b?.throughput_rps ?? 0,
    };
  });
  const axis = { fontSize: 11, fontFamily: "JetBrains Mono", fill: "#6B6558" };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline hairline mt-6" style={{ backgroundColor: "var(--hairline)" }}>
      <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
        <div className="label-anno mb-2">LATENCY · MS</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
            <XAxis dataKey="name" tick={axis} stroke="#6B6558" />
            <YAxis tick={axis} stroke="#6B6558" />
            <Tooltip contentStyle={{ background: "#F2EFE6", border: "1px solid #1B2330", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }} />
            <Bar dataKey="p50" fill="#2952A3" />
            <Bar dataKey="p95" fill="#6B6558" />
            <Bar dataKey="p99" fill="#B8472E" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
        <div className="label-anno mb-2">THROUGHPUT · RPS</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
            <XAxis dataKey="name" tick={axis} stroke="#6B6558" />
            <YAxis tick={axis} stroke="#6B6558" />
            <Tooltip contentStyle={{ background: "#F2EFE6", border: "1px solid #1B2330", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 12 }} />
            <Bar dataKey="rps" fill="#2952A3" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
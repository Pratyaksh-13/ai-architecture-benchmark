import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Protected } from "@/components/Shell";
import { ProjectTabs } from "@/components/ProjectTabs";
import {
  projects as projectsApi,
  ApiError,
  type Architecture,
  type Benchmark,
  type BenchmarkRun,
  type ResilienceScore,
} from "@/lib/api";
import {
  ARCH_META,
  AXIS_STYLE,
  TOOLTIP_STYLE,
  LEGEND_STYLE,
  downloadMarkdown,
  downloadPdf,
} from "@/lib/project-utils";
import { Mermaid } from "@/components/Mermaid";
import { CountUp } from "@/components/CountUp";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({ meta: [{ title: "Project — ArchBench" }] }),
  ssr: false,
  component: () => <Protected><ProjectOverview /></Protected>,
});

function ProjectOverview() {
  const { id } = Route.useParams();
  const pid = Number(id);
  const qc = useQueryClient();
  const matchRoute = useMatchRoute();
  const isAnalysis = !!matchRoute({ to: "/projects/$id/analysis", params: { id } });
  const isSummary  = !!matchRoute({ to: "/projects/$id/summary",  params: { id } });
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
  const resilienceQ = useQuery({
    queryKey: ["resilience", pid],
    queryFn: async () => { try { return await projectsApi.resilience(pid); } catch { return []; } },
  });
  const historyQ = useQuery({
    queryKey: ["history", pid],
    queryFn: async () => { try { return await projectsApi.history(pid); } catch { return []; } },
  });

  const [polling,   setPolling]   = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [pollError, setPollError] = useState<string | null>(null);
  const [profile,   setProfile]   = useState<"light" | "medium" | "heavy">("medium");
  const [dlMd,      setDlMd]      = useState(false);
  const [dlPdf,     setDlPdf]     = useState(false);
  const [benchMode, setBenchMode] = useState<"simulated" | "real" | "async" | null>(null);
  const [jobStatus, setJobStatus] = useState<{ status: string } | null>(null);
  const pollStartRef = useRef<number>(0);
  const baselineRef  = useRef<string>("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobPollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!polling) { setElapsed(0); return; }
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - pollStartRef.current) / 1000));
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [polling]);

  useEffect(() => {
    if (!polling || benchMode === "async") return;
    pollTimerRef.current = setInterval(async () => {
      try {
        const fresh = await projectsApi.benchmarks(pid);
        const latestTs = [...fresh].sort((a, b) =>
          b.created_at.localeCompare(a.created_at))[0]?.created_at ?? "";
        if (latestTs && latestTs !== baselineRef.current) {
          qc.invalidateQueries({ queryKey: ["bench", pid] });
          qc.invalidateQueries({ queryKey: ["resilience", pid] });
          qc.invalidateQueries({ queryKey: ["history", pid] });
          setPolling(false);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [polling, benchMode, pid, qc]);

  useEffect(() => {
    return () => { if (jobPollRef.current) clearInterval(jobPollRef.current); };
  }, []);

  const runBench = useMutation({
    mutationFn: () => projectsApi.benchmark(pid, profile),
    onSuccess: () => {
      setBenchMode("simulated");
      const current = qc.getQueryData<Benchmark[]>(["bench", pid]) ?? [];
      baselineRef.current = [...current].sort((a, b) =>
        b.created_at.localeCompare(a.created_at))[0]?.created_at ?? "";
      setPollError(null);
      pollStartRef.current = Date.now();
      setPolling(true);
    },
    onError: (e: Error) => { setPollError(e.message); setPolling(false); },
  });

  const runBenchReal = useMutation({
    mutationFn: () => projectsApi.benchmarkReal(pid, profile),
    onMutate: () => { setPollError(null); pollStartRef.current = Date.now(); setPolling(true); setBenchMode("real"); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bench", pid] });
      qc.invalidateQueries({ queryKey: ["resilience", pid] });
      qc.invalidateQueries({ queryKey: ["history", pid] });
      setPolling(false);
    },
    onError: (e: Error) => { setPollError(e.message); setPolling(false); },
  });

  const runBenchAsync = useMutation({
    mutationFn: () => projectsApi.benchmarkRealAsync(pid, profile),
    onSuccess: (data) => {
      setPollError(null);
      pollStartRef.current = Date.now();
      setPolling(true);
      setBenchMode("async");
      jobIdRef.current = data.job_id;
      jobPollRef.current = setInterval(async () => {
        try {
          const status = await projectsApi.jobStatus(data.job_id);
          setJobStatus(status);
          if (status.status === "complete" || status.status === "failed") {
            clearInterval(jobPollRef.current!);
            setPolling(false);
            if (status.status === "complete") {
              qc.invalidateQueries({ queryKey: ["bench", pid] });
              qc.invalidateQueries({ queryKey: ["resilience", pid] });
              qc.invalidateQueries({ queryKey: ["history", pid] });
            } else {
              setPollError(`Job failed: ${status.error}`);
            }
          }
        } catch { /* ignore */ }
      }, 5000);
    },
    onError: (e: Error) => { setPollError(e.message); setPolling(false); },
  });

  const runRec = useMutation({
    mutationFn: () => projectsApi.recommend(pid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rec", pid] }),
  });

  if (isAnalysis || isSummary) return <Outlet />;
  if (projectQ.isLoading) return <div className="p-10 label-anno">LOADING PROJECT…</div>;
  if (projectQ.error) return <div className="p-10" style={{ color: "var(--annotation)" }}>{(projectQ.error as Error).message}</div>;

  const project    = projectQ.data!;
  const archs      = archQ.data       ?? [];
  const benches    = benchQ.data      ?? [];
  const rec        = recQ.data;
  const resilience = resilienceQ.data ?? [];
  const history    = historyQ.data    ?? [];
  const hasBenches = benches.length > 0;
  const benchRunning = polling || runBench.isPending || runBenchReal.isPending || runBenchAsync.isPending;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/" className="label-anno hover:text-ink">← BACK TO ARCHIVE</Link>

      <div className="mt-4 pb-0">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="label-anno">PROJECT #{String(project.id).padStart(4, "0")} · STATUS {project.status.toUpperCase()}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px hairline mt-8" style={{ backgroundColor: "var(--hairline)" }}>
        <div className="bg-paper p-6" style={{ backgroundColor: "var(--paper)" }}>
          <div className="label-anno mb-3">LOAD PROFILE · BENCHMARK MODE</div>
          <div className="flex gap-2 mb-4">
            {(["light", "medium", "heavy"] as const).map((p) => (
              <button key={p} onClick={() => setProfile(p)} className="label-anno border px-3 py-2"
                style={{
                  borderColor: profile === p ? "var(--ink)" : "var(--hairline)",
                  backgroundColor: profile === p ? "var(--ink)" : "transparent",
                  color: profile === p ? "var(--paper)" : "var(--ink)",
                }}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button disabled={benchRunning || archs.length === 0} onClick={() => runBench.mutate()} className="blueprint-btn disabled:opacity-50 w-full text-left">
              {runBench.isPending ? <span style={{ fontFamily: "var(--font-mono)" }}>SUBMITTING…</span>
                : polling && benchMode === "simulated" ? <span style={{ fontFamily: "var(--font-mono)" }}>RUNNING SIMULATED… {elapsed}s</span>
                : "↯ SIMULATED BENCHMARK"}
            </button>
            <button disabled={benchRunning || archs.length === 0} onClick={() => runBenchReal.mutate()} className="ghost-btn disabled:opacity-50 w-full text-left">
              {runBenchReal.isPending ? <span style={{ fontFamily: "var(--font-mono)" }}>DEPLOYING + TESTING… {elapsed}s</span>
                : "⬡ REAL BENCHMARK · BLOCKING"}
            </button>
            <button disabled={benchRunning || archs.length === 0} onClick={() => runBenchAsync.mutate()} className="ghost-btn disabled:opacity-50 w-full text-left">
              {runBenchAsync.isPending ? <span style={{ fontFamily: "var(--font-mono)" }}>QUEUING…</span>
                : polling && benchMode === "async" ? <span style={{ fontFamily: "var(--font-mono)" }}>JOB RUNNING… {elapsed}s · {jobStatus?.status?.toUpperCase()}</span>
                : "⟳ REAL BENCHMARK · ASYNC QUEUE"}
            </button>
          {polling && benchMode === "async" && (
            <button
              onClick={async () => {
                if (jobIdRef.current) {
                  await projectsApi.cancelJob(jobIdRef.current).catch(() => {});
                  if (jobPollRef.current) clearInterval(jobPollRef.current);
                  jobIdRef.current = null;
                  setPolling(false);
                  setPollError("Job cancelled.");
                }
              }}
              className="ghost-btn w-full text-left"
              style={{ color: "var(--annotation)", borderColor: "var(--annotation)" }}
            >
              ✕ STOP JOB
            </button>
          )}
          </div>
          <div className="mt-2 text-xs label-anno" style={{ color: "var(--graphite)" }}>
            SIMULATED = instant · REAL = deploys docker + k6 (~5 min) · ASYNC = queued job
          </div>
          {(runBench.error || runBenchReal.error || runBenchAsync.error || pollError) && (
            <div className="mt-2 text-xs" style={{ color: "var(--annotation)", fontFamily: "var(--font-mono)" }}>
              {pollError ?? ((runBench.error || runBenchReal.error || runBenchAsync.error) as Error)?.message}
            </div>
          )}
        </div>

        <div className="bg-paper p-6" style={{ backgroundColor: "var(--paper)" }}>
          <div className="label-anno mb-3">REVIEWER VERDICT</div>
          <p className="text-sm mb-4" style={{ color: "var(--graphite)" }}>
            {hasBenches ? "Benchmarks on file. Ready for review." : "Run a benchmark first — verdicts require measured data."}
          </p>
          <button disabled={!hasBenches || runRec.isPending} onClick={() => runRec.mutate()} className="ink-btn disabled:opacity-40 w-full">
            {runRec.isPending ? "Reviewing…" : rec ? "Re-evaluate" : "Get recommendation"}
          </button>
          {runRec.error && <div className="mt-2 text-xs" style={{ color: "var(--annotation)" }}>{(runRec.error as Error).message}</div>}
        </div>
      </div>

      <section className="mt-10">
        <div className="label-anno mb-4">ARCHITECTURES · {archs.length} / 3</div>
        {archQ.isLoading && <div className="label-anno">LOADING DRAWINGS…</div>}
        <div className="grid grid-cols-1 gap-6">
          {archs.map((a) => <ArchCard key={a.id} arch={a} winner={rec?.recommended_arch_type === a.arch_type} />)}
        </div>
      </section>

      {hasBenches && (
        <section className="mt-12">
          <div className="label-anno mb-4">BENCHMARK RESULTS · {benches[0]?.load_profile.toUpperCase()} LOAD</div>
          <BenchmarkTable archs={archs} benches={benches} />
          <BenchmarkCharts archs={archs} benches={benches} />
        </section>
      )}

      {(resilience.length > 0 || resilienceQ.isFetched) && (
        <ResilienceSection archs={archs} scores={resilience} />
      )}

      {(history.length > 0 || historyQ.isFetched) && (
        <HistorySection archs={archs} history={history} />
      )}

      {rec && (
        <div className="mt-8 hairline p-6 relative" style={{ borderColor: "var(--annotation)", backgroundColor: "rgba(184,71,46,0.04)" }}>
          <div className="label-anno mb-2" style={{ color: "var(--annotation)" }}>
            REVIEWER NOTE · CONFIDENCE {(rec.confidence_score * 100).toFixed(0)}%
          </div>
          <h3 className="text-2xl mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--annotation)" }}>
            Recommended: {ARCH_META[rec.recommended_arch_type]?.title ?? rec.recommended_arch_type}
          </h3>
          <p className="text-sm" style={{ color: "var(--ink)" }}>{rec.reasoning}</p>
          <div className="label-anno mt-3" style={{ color: "var(--graphite)" }}>SIGNED · {rec.llm_provider.toUpperCase()}</div>
        </div>
      )}
    </div>
  );
}

function ArchCard({ arch, winner }: { arch: Architecture; winner: boolean }) {
  const meta = ARCH_META[arch.arch_type] ?? { title: arch.arch_type, num: "—" };
  return (
    <article className="hairline p-6 relative" style={{ backgroundColor: "var(--paper)" }}>
      {winner && (
        <div className="absolute -top-3 -right-3 z-10 animate-stamp label-anno px-4 py-2"
          style={{ border: "2px solid var(--annotation)", color: "var(--annotation)", backgroundColor: "var(--paper)", transform: "rotate(-3deg)", letterSpacing: "0.22em" }}>
          ★ RECOMMENDED
        </div>
      )}
      <div className="flex items-baseline justify-between border-b border-hairline pb-3 mb-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
          <span className="label-anno mr-3">ARCHITECTURE {meta.num}</span>{meta.title}
        </h2>
        <span className="label-anno" style={{ color: "var(--graphite)" }}>{arch.llm_provider}</span>
      </div>
      <div className="my-6 hairline p-4" style={{ backgroundColor: "var(--secondary)" }}>
        <Mermaid chart={arch.mermaid_diagram} />
      </div>
      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--ink)" }}>{arch.explanation}</p>
      {arch.tradeoffs && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ backgroundColor: "var(--hairline)" }}>
          <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
            <div className="label-anno mb-2" style={{ color: "var(--blueprint)" }}>PROS</div>
            <ul className="text-sm space-y-1">{arch.tradeoffs.pros.map((p, i) => <li key={i}>+ {p}</li>)}</ul>
          </div>
          <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
            <div className="label-anno mb-2" style={{ color: "var(--annotation)" }}>CONS</div>
            <ul className="text-sm space-y-1">{arch.tradeoffs.cons.map((c, i) => <li key={i}>− {c}</li>)}</ul>
          </div>
        </div>
      )}
    </article>
  );
}

const BENCH_ROWS = [
  { k: "latency_p50_ms"  as const, label: "Latency p50", suffix: " ms", d: 1 },
  { k: "latency_p95_ms"  as const, label: "Latency p95", suffix: " ms", d: 1 },
  { k: "latency_p99_ms"  as const, label: "Latency p99", suffix: " ms", d: 1 },
  { k: "throughput_rps"  as const, label: "Throughput",  suffix: " rps", d: 0 },
  { k: "error_rate_pct"  as const, label: "Error rate",  suffix: " %",  d: 2 },
  { k: "cpu_usage_pct"   as const, label: "CPU usage",   suffix: " %",  d: 1 },
  { k: "memory_usage_mb" as const, label: "Memory",      suffix: " MB", d: 0 },
];

function BenchmarkTable({ archs, benches }: { archs: Architecture[]; benches: Benchmark[] }) {
  const byArch = (id: number) => benches.find((b) => b.architecture_id === id);
  return (
    <div className="hairline overflow-x-auto" style={{ backgroundColor: "var(--paper)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--hairline)" }}>
            <th className="text-left p-3 label-anno">METRIC</th>
            {archs.map((a) => <th key={a.id} className="text-right p-3 label-anno">{ARCH_META[a.arch_type]?.title ?? a.arch_type}</th>)}
          </tr>
        </thead>
        <tbody>
          {BENCH_ROWS.map((r) => (
            <tr key={r.k} className="border-b last:border-0" style={{ borderColor: "var(--hairline)" }}>
              <td className="p-3 label-anno" style={{ color: "var(--ink)" }}>{r.label}</td>
              {archs.map((a) => {
                const b = byArch(a.id);
                return (
                  <td key={a.id} className="p-3 text-right" style={{ fontFamily: "var(--font-mono)" }}>
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px hairline mt-6" style={{ backgroundColor: "var(--hairline)" }}>
      <div className="p-4" style={{ backgroundColor: "var(--paper)" }}>
        <div className="label-anno mb-2">LATENCY · MS</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
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
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid stroke="#C9C2AE" strokeDasharray="2 4" />
            <XAxis dataKey="name" tick={AXIS_STYLE} stroke="#6B6558" />
            <YAxis tick={AXIS_STYLE} stroke="#6B6558" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="rps" fill="#2952A3" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ResilienceSection({ archs, scores }: { archs: Architecture[]; scores: ResilienceScore[] }) {
  const archName = (id: number) => {
    const a = archs.find((x) => x.id === id);
    return a ? (ARCH_META[a.arch_type]?.title ?? a.arch_type) : `Arch ${id}`;
  };
  return (
    <section className="mt-12">
      <div className="label-anno mb-4">RESILIENCE ANALYSIS</div>
      {scores.length === 0 ? (
        <div className="hairline p-6 label-anno" style={{ backgroundColor: "var(--paper)", color: "var(--graphite)" }}>
          NO RESILIENCE DATA YET · RUN A REAL BENCHMARK
        </div>
      ) : (
        <div className="hairline overflow-x-auto" style={{ backgroundColor: "var(--paper)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--hairline)" }}>
                {["ARCHITECTURE", "RESILIENCE SCORE", "AVAILABILITY %", "FAILURE TYPE", "RECOVERED", "RECOVERY TIME"].map((h) => (
                  <th key={h} className={`p-3 label-anno ${h === "ARCHITECTURE" ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.id} className="border-b last:border-0" style={{ borderColor: "var(--hairline)" }}>
                  <td className="p-3 label-anno" style={{ color: "var(--ink)" }}>{archName(s.architecture_id).toUpperCase()}</td>
                  <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{s.resilience_score}/100</td>
                  <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)" }}>{s.availability_pct.toFixed(2)}%</td>
                  <td className="p-3 text-right label-anno" style={{ color: "var(--graphite)" }}>
                    {s.failure_type ? s.failure_type.replace(/_/g, " ").toUpperCase() : "—"}
                  </td>
                  <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)", color: s.recovered ? "var(--blueprint)" : "var(--annotation)" }}>
                    {s.recovered ? "✓" : "✗"}
                  </td>
                  <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                    {s.recovery_time_ms != null ? `${s.recovery_time_ms}ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HistoryRunRow({ run, archs }: { run: BenchmarkRun; archs: Architecture[] }) {
  const [open, setOpen] = useState(false);
  const archName = ARCH_META[archs.find((a) => a.id === run.architecture_id)?.arch_type ?? ""]?.title ?? `Arch ${run.architecture_id}`;
  return (
    <div className="border-b last:border-0" style={{ borderColor: "var(--hairline)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left" style={{ background: "none", cursor: "pointer" }}>
        <span className="label-anno" style={{ color: "var(--ink)" }}>
          {new Date(run.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          &nbsp;·&nbsp;{run.load_profile.toUpperCase()}&nbsp;·&nbsp;{archName.toUpperCase()}
        </span>
        <span className="label-anno" style={{ color: "var(--blueprint)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--hairline)" }}>
                {["P50 MS", "P95 MS", "P99 MS", "RPS", "ERR %", "CPU %", "MEM MB"].map((h) => (
                  <th key={h} className="text-right p-2 label-anno">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {[
                  run.latency_p50_ms.toFixed(1), run.latency_p95_ms.toFixed(1), run.latency_p99_ms.toFixed(1),
                  run.throughput_rps.toFixed(0), run.error_rate_pct.toFixed(2), run.cpu_usage_pct.toFixed(1), run.memory_usage_mb.toFixed(0),
                ].map((v, i) => <td key={i} className="text-right p-2">{v}</td>)}
              </tr>
            </tbody>
          </table>
          <div className="mt-1 label-anno" style={{ color: "var(--graphite)" }}>SIM TYPE: {run.simulation_type.toUpperCase()}</div>
        </div>
      )}
    </div>
  );
}

function HistorySection({ archs, history }: { archs: Architecture[]; history: BenchmarkRun[] }) {
  const sorted = [...history].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <section className="mt-10">
      <details className="hairline" style={{ backgroundColor: "var(--paper)" }}>
        <summary className="p-4 cursor-pointer flex items-center justify-between select-none" style={{ listStyle: "none" }}>
          <span className="label-anno">BENCHMARK HISTORY · {history.length} RUN{history.length !== 1 ? "S" : ""}</span>
          <span className="label-anno" style={{ color: "var(--blueprint)" }}>▾</span>
        </summary>
        <div className="border-t" style={{ borderColor: "var(--hairline)" }}>
          {sorted.length === 0
            ? <div className="p-6 label-anno" style={{ color: "var(--graphite)" }}>NO HISTORY YET · RUN A BENCHMARK</div>
            : sorted.map((run) => <HistoryRunRow key={run.id} run={run} archs={archs} />)}
        </div>
      </details>
    </section>
  );
}

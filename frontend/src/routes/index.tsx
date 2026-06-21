import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Protected } from "@/components/Shell";
import { projects as projectsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — ArchBench" }] }),
  ssr:false,
  component: () => <Protected><Dashboard /></Protected>,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    enabled: !!user,
  });

  const total = projects?.length ?? 0;
  const done = projects?.filter((p) => p.status === "done").length ?? 0;
  const archCount = done * 3;
  const completion = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between border-b border-hairline pb-6 mb-8">
        <div>
          <div className="label-anno">DRAWING SET · INDEX</div>
          <h1 className="text-4xl mt-2">Project archive</h1>
        </div>
        <Link to="/new" className="ink-btn">+ New comparison</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline hairline mb-10" style={{ backgroundColor: "var(--hairline)" }}>
        <Stat label="Projects" value={total} />
        <Stat label="Architectures" value={archCount} />
        <Stat label="Completion" value={`${completion}%`} />
      </div>

      {isLoading && <div className="label-anno">LOADING ARCHIVE…</div>}
      {error && <div className="hairline p-4" style={{ color: "var(--annotation)" }}>{(error as Error).message}</div>}

      {projects && projects.length === 0 && (
        <div className="hairline p-12 text-center bg-secondary">
          <div className="label-anno mb-4">EMPTY ARCHIVE</div>
          <p style={{ fontFamily: "var(--font-display)" }} className="text-2xl mb-6">
            No comparisons yet — describe a system to begin.
          </p>
          <Link to="/new" className="blueprint-btn inline-block">Start drafting</Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <ul className="hairline divide-y divide-hairline" style={{ borderColor: "var(--hairline)" }}>
          {projects.map((p) => (
            <li key={p.id} style={{ borderColor: "var(--hairline)" }} className="border-t first:border-t-0">
              <Link to="/projects/$id" params={{ id: String(p.id) }} className="flex items-start justify-between gap-6 p-5 hover:bg-secondary">
                <div className="min-w-0 flex-1">
                  <div className="label-anno mb-2">PROJECT #{String(p.id).padStart(4, "0")}</div>
                  <div className="line-clamp-2" style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>{p.requirement}</div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={p.status} />
                  <div className="label-anno">{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-paper p-6" style={{ backgroundColor: "var(--paper)" }}>
      <div className="label-anno">{label}</div>
      <div className="mono mt-2 text-3xl" style={{ color: "var(--blueprint)" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    done: { c: "var(--blueprint)", t: "COMPLETE" },
    generating: { c: "var(--graphite)", t: "DRAFTING" },
    pending: { c: "var(--graphite)", t: "PENDING" },
    failed: { c: "var(--annotation)", t: "FAILED" },
  };
  const s = map[status] ?? { c: "var(--graphite)", t: status.toUpperCase() };
  return (
    <span className="label-anno border px-2 py-1" style={{ color: s.c, borderColor: s.c }}>{s.t}</span>
  );
}

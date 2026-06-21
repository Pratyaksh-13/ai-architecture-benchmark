import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Shell";
import { projects as projectsApi } from "@/lib/api";

export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "New comparison — ArchBench" }] }),
  ssr:false,
  component: () => <Protected><NewProject /></Protected>,
});

const STEPS = [
  "Drafting monolithic architecture…",
  "Drafting microservices architecture…",
  "Drafting event-driven architecture…",
  "Reviewing tradeoffs…",
];

function NewProject() {
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2500);
    return () => clearInterval(t);
  }, [busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setStep(0);
    try {
      const project = await projectsApi.create(requirement);
      await projectsApi.generate(project.id, null);
      navigate({ to: "/projects/$id", params: { id: String(project.id) } });
    } catch (e: any) {
      setErr(e?.message ?? "Generation failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="label-anno">SHEET B · NEW SPECIFICATION</div>
      <h1 className="text-4xl mt-2 mb-8">Describe your system</h1>

      <form onSubmit={submit} className="hairline p-8 space-y-6" style={{ backgroundColor: "var(--paper)" }}>
        <label className="block">
          <span className="label-anno block mb-2">Requirement · plain English</span>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            rows={8}
            required
            disabled={busy}
            placeholder="e.g. A real-time bidding platform for ~50k concurrent users with sub-100ms latency, ad inventory in postgres, fraud detection pipeline…"
            className="w-full bg-transparent border border-hairline px-4 py-3 font-mono text-sm focus:outline-none focus:border-ink resize-y"
            style={{ borderColor: "var(--hairline)", fontFamily: "var(--font-mono)" }}
          />
        </label>

        

        {err && <div className="hairline p-3 text-sm" style={{ color: "var(--annotation)", borderColor: "var(--annotation)" }}>{err}</div>}

        {busy ? (
          <div className="hairline p-6 text-center" style={{ backgroundColor: "var(--secondary)" }}>
            <div className="label-anno mb-3" style={{ color: "var(--blueprint)" }}>GENERATION IN PROGRESS · 10–20 SEC</div>
            <div key={step} className="mono text-lg animate-route-in" style={{ color: "var(--ink)" }}>{STEPS[step]}</div>
          </div>
        ) : (
          <button className="ink-btn w-full">Generate comparison</button>
        )}
      </form>
    </div>
  );
}
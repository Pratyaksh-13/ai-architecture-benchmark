import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { auth, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Shell } from "@/components/Shell";
import { PublicShell } from "@/components/Shell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — ArchBench" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setUnverified(false); setBusy(true);
    try {
      await auth.login(email, password);
      await refresh();
      navigate({ to: "/" });
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.status === 403) { setUnverified(true); setErr("Email not verified. Check your inbox or resend the link below."); }
        else if (e.status === 401) setErr("Wrong email or password.");
        else setErr(e.message);
      } else setErr("Network error");
    } finally { setBusy(false); }
  }

  async function resend() {
    try { await auth.resend(email); setErr("Verification email resent. Check your inbox."); setUnverified(false); }
    catch (e: any) { setErr(e?.message ?? "Could not resend"); }
  }

  return (
  <PublicShell>
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="label-anno">SHEET A · ACCESS</div>
      <h1 className="text-4xl mt-2 mb-8">Sign in</h1>
      <form onSubmit={submit} className="space-y-5 hairline p-8" style={{ backgroundColor: "var(--paper)" }}>
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        {err && (
          <div className="hairline p-3 text-sm" style={{ color: "var(--annotation)", borderColor: "var(--annotation)" }}>
            <span className="label-anno block mb-1" style={{ color: "var(--annotation)" }}>NOTICE</span>
            {err}
            {unverified && (
              <button type="button" onClick={resend} className="ghost-btn mt-3 block">Resend verification</button>
            )}
          </div>
        )}
        <button disabled={busy} className="ink-btn w-full disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="mt-6 label-anno text-center">
        No account? <Link to="/signup" style={{ color: "var(--blueprint)" }}>CREATE ONE</Link>
      </div>
    </div>
  </PublicShell>
);
}

export function Field({ label, type, value, onChange, required }: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="label-anno block mb-1.5">{label}</span>
      <input
        type={type ?? "text"}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border border-hairline px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-ink"
        style={{ borderColor: "var(--hairline)", fontFamily: "var(--font-mono)" }}
      />
    </label>
  );
}
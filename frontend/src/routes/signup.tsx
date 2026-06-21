import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { auth } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Field } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — ArchBench" }] }),
  component: Signup,
});

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await auth.signup(email, password);
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? "Signup failed");
    } finally { setBusy(false); }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="label-anno">SHEET A · ENROLLMENT</div>
        <h1 className="text-4xl mt-2 mb-8">Create account</h1>

        {done ? (
          <div className="hairline p-8" style={{ backgroundColor: "var(--paper)" }}>
            <div className="label-anno mb-3" style={{ color: "var(--blueprint)" }}>STAMPED · APPROVED</div>
            <h2 className="text-2xl mb-3" style={{ fontFamily: "var(--font-display)" }}>Check your email</h2>
            <p className="text-sm" style={{ color: "var(--graphite)" }}>
              We sent a verification link to <span className="mono" style={{ color: "var(--ink)" }}>{email}</span>.
              Click it to activate your account, then sign in.
            </p>
            <Link to="/login" className="ghost-btn inline-block mt-6">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 hairline p-8" style={{ backgroundColor: "var(--paper)" }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            {err && <div className="hairline p-3 text-sm" style={{ color: "var(--annotation)", borderColor: "var(--annotation)" }}>{err}</div>}
            <button disabled={busy} className="ink-btn w-full disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
          </form>
        )}

        <div className="mt-6 label-anno text-center">
          Already have one? <Link to="/login" style={{ color: "var(--blueprint)" }}>SIGN IN</Link>
        </div>
      </div>
    </Shell>
  );
}
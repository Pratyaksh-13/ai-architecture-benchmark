import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/lib/api";
import { Shell } from "@/components/Shell";

type Search = { token?: string };

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>): Search => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({ meta: [{ title: "Verify email — ArchBench" }] }),
  component: Verify,
});

function Verify() {
  const { token } = useSearch({ from: "/verify-email" });
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try { const r = await auth.verify(token); setState("ok"); setMsg(r.message ?? "Email verified."); }
      catch (e: any) { setState("err"); setMsg(e?.message ?? "Verification failed"); }
    })();
  }, [token]);

  return (
    <Shell>
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="label-anno">SHEET A · VERIFICATION</div>
        <h1 className="text-4xl mt-2 mb-8">Email verification</h1>
        <div className="hairline p-8" style={{ backgroundColor: "var(--paper)" }}>
          {!token && <p className="text-sm" style={{ color: "var(--graphite)" }}>No token provided. Use the link in your verification email.</p>}
          {token && state === "idle" && <div className="label-anno">VERIFYING…</div>}
          {state === "ok" && (
            <>
              <div className="label-anno mb-2" style={{ color: "var(--blueprint)" }}>STAMPED · VERIFIED</div>
              <p className="text-sm mb-6" style={{ color: "var(--graphite)" }}>{msg}</p>
              <Link to="/login" className="ink-btn inline-block">Sign in</Link>
            </>
          )}
          {state === "err" && (
            <>
              <div className="label-anno mb-2" style={{ color: "var(--annotation)" }}>REJECTED</div>
              <p className="text-sm mb-6">{msg}</p>
              <Link to="/login" className="ghost-btn inline-block">Back</Link>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
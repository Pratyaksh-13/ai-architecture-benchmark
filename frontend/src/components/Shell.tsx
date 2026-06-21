import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect, type ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-hairline bg-paper" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3">
            <span style={{ fontFamily: "var(--font-display)" }} className="text-2xl tracking-tight">ArchBench</span>
            <span className="label-anno hidden sm:inline">SYSTEM ARCHITECTURE BENCH · v1.0</span>
          </Link>
          <nav className="flex items-center gap-6">
            {user && (
              <>
                <Link to="/" className="label-anno hover:text-ink" activeProps={{ style: { color: "var(--ink)" } }}>Dashboard</Link>
                <Link to="/new" className="label-anno hover:text-ink">New</Link>
                <span className="label-anno hidden md:inline" style={{ color: "var(--graphite)" }}>{user.email}</span>
                <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="ghost-btn">Sign out</button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 animate-route-in">{children}</main>
      <footer className="border-t border-hairline mt-16">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between label-anno">
          <span>SHEET 01 / 01</span>
          <span>DRAWN BY ARCHBENCH · NOT FOR CONSTRUCTION</span>
        </div>
      </footer>
    </div>
  );
}

export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="label-anno">LOADING SESSION…</div>
      </div>
    );
  }
  if (!user) return null;
  return <Shell>{children}</Shell>;
}
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, type User } from "./api";

type State = { user: User | null; loading: boolean };
const Ctx = createContext<{
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}>({ user: null, loading: true, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ user: null, loading: true });

  const refresh = async () => {
    try {
      const u = await auth.me();
      setState({ user: u, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  };

  useEffect(() => { refresh(); }, []);

  const signOut = async () => {
    try { await auth.logout(); } catch {}
    setState({ user: null, loading: false });
  };

  return <Ctx.Provider value={{ ...state, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
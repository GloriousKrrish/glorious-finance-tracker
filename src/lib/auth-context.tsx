import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: (scope?: "global" | "local" | "others") => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null, user: null, role: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION") return;
      setSession(s);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user) { setRole(null); return; }
    let cancelled = false;
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setRole((data?.role as AppRole) ?? "user"); });

    // record device session (best-effort)
    const label = deviceLabel();
    supabase.from("device_sessions").insert({
      user_id: session.user.id,
      device_label: label.name,
      user_agent: navigator.userAgent,
    }).then(() => {});

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signOut = async (scope: "global" | "local" | "others" = "local") => {
    await supabase.auth.signOut({ scope });
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

function deviceLabel() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/.test(ua);
  const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
  const os = /Mac/.test(ua) ? "macOS" : /Win/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iP(hone|ad)/.test(ua) ? "iOS" : "Unknown";
  return { name: `${browser} on ${os}${isMobile ? " (Mobile)" : ""}` };
}

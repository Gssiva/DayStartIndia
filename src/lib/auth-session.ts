import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "daystart.remember-me";
const TAB_MARK = "daystart.session-active";

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  sessionStorage.setItem(TAB_MARK, "1");
}

/**
 * Automatic session restore policy. Supabase already persists + refreshes tokens
 * in localStorage; when the user opted out of "remember me" we end the session
 * as soon as they come back in a brand new browser session.
 */
export async function applyRememberPolicy() {
  if (typeof window === "undefined") return;
  const remember = localStorage.getItem(REMEMBER_KEY);
  const sameTabSession = sessionStorage.getItem(TAB_MARK) === "1";
  if (remember === "0" && !sameTabSession) {
    await supabase.auth.signOut();
    localStorage.removeItem(REMEMBER_KEY);
    return;
  }
  sessionStorage.setItem(TAB_MARK, "1");
}

export async function signOutSecurely() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TAB_MARK);
  }
  await supabase.auth.signOut();
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export type CustomerInfo = { name: string | null; email: string | null; phone: string | null };

export function customerInfo(user: User | null): CustomerInfo {
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; phone?: string };
  return {
    name: meta.full_name ?? meta.name ?? null,
    email: user?.email ?? null,
    phone: meta.phone ?? null,
  };
}

export function formatPhone(phone: string | null): string | null {
  return phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : null;
}

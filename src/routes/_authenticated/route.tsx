import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Primary check: revalidate the user with the auth server.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch {
      /* network hiccup — fall through to the local session check below */
    }

    // Fallback: a locally persisted (and still valid) session keeps the user in.
    // This prevents a transient network error from logging people out mid-flow.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (session?.user) {
      const expired = session.expires_at ? session.expires_at * 1000 < Date.now() : false;
      if (!expired) return { user: session.user };
    }

    throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: () => <Outlet />,
});

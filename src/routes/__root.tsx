import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { SplashScreen } from "../components/SplashScreen";
import { MotionProvider } from "../components/motion";
import { LOGO_PRIMARY_SRC } from "../components/Logo";
import { Toaster } from "@/components/ui/sonner";

import { supabase } from "@/integrations/supabase/client";
import { applyRememberPolicy } from "@/lib/auth-session";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="wordmark text-7xl text-brand-red">404</p>
          <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-brand-red px-5 text-sm font-semibold text-white"
          >
            Go home
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center rounded-full bg-brand-red px-5 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-semibold"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DayStart — Verified daily workers, on demand" },
      {
        name: "description",
        content:
          "DayStart directly employs verified daily workers — agriculture, beauty, construction, drivers — and auto-assigns them to your booking in under 60 seconds.",
      },
      { name: "author", content: "DayStart" },
      { name: "theme-color", content: "#C8001A" },
      { property: "og:title", content: "DayStart — Verified daily workers, on demand" },
      {
        property: "og:description",
        content:
          "Turning every morning into new opportunity. Verified workers, fair wages, transparent pricing.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "DayStart" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DayStart — Verified daily workers, on demand" },
      { name: "twitter:description", content: "Turning every morning into new opportunity." },
      { property: "og:image", content: "https://daystart.co.in/og-image.png" },
      { name: "twitter:image", content: "https://daystart.co.in/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preload", as: "image", href: LOGO_PRIMARY_SRC, fetchPriority: "high" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/android-chrome-192x192.png" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Baloo+2:wght@600;700;800&display=swap",
      },
    ],

    scripts: [
      {
        // Runs before first paint: marks JS as available + skips the preloader on repeat visits.
        children:
          "try{var d=document.documentElement;d.classList.add('js');if(sessionStorage.getItem('ds-splash-seen'))d.classList.add('splash-skip')}catch(e){document.documentElement.classList.add('js')}",
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DayStart",
          url: "https://daystart.co.in",
          logo: "https://daystart.co.in/logo.png",
          image: "https://daystart.co.in/og-image.png",
          description:
            "Technology-enabled daily labour employment platform for India. Verified workers, fair wages, transparent pricing.",
          email: "info@daystart.co.in",
          telephone: "+91 90320 78142",
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "info@daystart.co.in",
              telephone: "+91 90320 78142",
              areaServed: "IN",
              availableLanguage: ["en", "te", "hi"],
            },
            {
              "@type": "ContactPoint",
              contactType: "human resources",
              email: "hr@daystart.co.in",
              telephone: "+91 90320 78142",
              areaServed: "IN",
            },
            {
              "@type": "ContactPoint",
              contactType: "sales",
              email: "gsk@daystart.co.in",
              telephone: "+91 90320 78142",
              areaServed: "IN",
            },
          ],
          address: {
            "@type": "PostalAddress",
            addressLocality: "Visakhapatnam",
            addressRegion: "Andhra Pradesh",
            addressCountry: "IN",
          },
          areaServed: { "@type": "Country", name: "India" },

          sameAs: [],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    void applyRememberPolicy();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreen />
      <MotionProvider />

      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

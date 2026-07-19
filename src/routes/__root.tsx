import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { StoreProvider } from "@/lib/store";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, Sparkles } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist in your workspace.</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go home</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GloriousFinance — AI Wealth Operating System" },
      { name: "description", content: "GloriousFinance is a premium AI-powered financial OS to manage accounts, budgets, investments, loans, goals, and taxes — all in INR." },
      { name: "author", content: "GloriousFinance" },
      { property: "og:title", content: "GloriousFinance — AI Wealth Operating System" },
      { property: "og:description", content: "Manage every rupee of your financial life with an editorial, quiet-luxury wealth dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth";

  useEffect(() => {
    if (loading) return;
    if (!session && !isAuthRoute) navigate({ to: "/auth", replace: true });
  }, [session, loading, isAuthRoute, navigate]);

  if (loading) return <BootScreen />;

  if (isAuthRoute) return <Outlet />;

  if (!session) return <BootScreen />;

  return (
    <StoreProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:px-6">
              <SidebarTrigger />
              <div className="ml-2 hidden text-xs font-medium uppercase tracking-widest text-muted-foreground md:block">
                Private Wealth Console
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-xs text-muted-foreground md:inline">All values in INR</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">GF</div>
              </div>
            </header>
            <main className="flex-1"><Outlet /></main>
          </div>
        </div>
      </SidebarProvider>
    </StoreProvider>
  );
}

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-canvas via-background to-ivory">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
          <Sparkles className="h-5 w-5 text-gold" />
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">GloriousFinance</div>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

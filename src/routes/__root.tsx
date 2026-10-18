import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { THEME_BOOT } from "../lib/theme";
import { onForeignLogout } from "../lib/session";
import { API_BASE } from "../lib/api/config";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

/** After a new publish, old chunk names vanish; reload once to pick up the fresh build. */
const CHUNK_RECOVERY = `(function(){var K="erasmus.chunk-reload";function stale(m){return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(m||""))}function go(){try{var t=Number(sessionStorage.getItem(K)||0);if(Date.now()-t<10000)return;sessionStorage.setItem(K,String(Date.now()))}catch(e){}location.reload()}window.addEventListener("vite:preloadError",function(e){e.preventDefault();go()});window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(stale(r&&r.message||r))go()});window.__erasmusChunkReload=function(m){if(stale(m)){go();return true}return false}})();`;

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error);
    const w = window as unknown as { __erasmusChunkReload?: (m: string) => boolean };
    if (w.__erasmusChunkReload?.(msg)) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          La página no se pudo cargar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal. Prueba a recargar o vuelve al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

const API_ORIGIN = (() => { try { return API_BASE.startsWith("http") ? new URL(API_BASE).origin : ""; } catch { return ""; } })();
/** Blocks third-party scripts, plugins, <base> hijacking and form exfiltration; network only to this site and the model server. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${API_ORIGIN}`.trim(),
  `connect-src 'self' ${API_ORIGIN}`.trim(),
  "frame-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Production-only CSP (dev needs Vite's HMR). frame-ancestors must be set by nginx: it is ignored in <meta>.
      ...(import.meta.env.PROD ? [{ httpEquiv: "Content-Security-Policy", content: CSP }] : []),
      { name: "referrer", content: "no-referrer" },
      { title: "Erasmus Web" },
      { name: "description", content: "Cliente web de Erasmus Platform." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
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
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Sign-out in another tab of this browser ends this tab's session too.
    return onForeignLogout(() => { queryClient.clear(); window.location.assign("/entrar"); });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" richColors={false} />
    </QueryClientProvider>
  );
}

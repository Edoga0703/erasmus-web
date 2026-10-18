import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/session";

/** Gate for everything that needs a signed-in user. Client-only: the session lives in sessionStorage. */
export const Route = createFileRoute("/_auth")({
  ssr: false,
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: "/entrar" });
  },
  component: Outlet,
});

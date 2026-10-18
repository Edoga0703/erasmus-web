import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/chat")({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: "/entrar" });
  },
  head: () => ({
    meta: [
      { title: "Chat — Erasmus" },
      { name: "description", content: "Tu espacio privado de conversación con Erasmus." },
      { property: "og:title", content: "Chat — Erasmus" },
      { property: "og:description", content: "Tu espacio privado de conversación con Erasmus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppShell,
});

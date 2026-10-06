import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/_auth/chat")({
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

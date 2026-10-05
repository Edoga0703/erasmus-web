import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Erasmus Web — Agente de IA para profesionales" },
      { name: "description", content: "Cliente web de Erasmus: chat con streaming, bloques de trabajo y archivos del workspace." },
      { property: "og:title", content: "Erasmus Web — Agente de IA para profesionales" },
      { property: "og:description", content: "Cliente web de Erasmus: chat con streaming, bloques de trabajo y archivos del workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppShell,
});

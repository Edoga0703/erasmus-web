import { parseSegments } from "@/lib/blocks";
import type { UIMessage } from "@/hooks/use-chat";

export interface ActivityItem {
  id: string;
  messageId: string;
  label: string;
  target: string;
  status: string;
  durationMs: number;
  file: boolean;
}

const LABELS: Record<string, string> = {
  "code:python": "Procesó una tarea",
  "code:bash": "Procesó una tarea",
  "file:list": "Revisó archivos",
  "file:read": "Leyó un archivo",
  "file:write": "Creó o actualizó un archivo",
  "file:append": "Amplió un archivo",
};

export function messageActivity(message: UIMessage): ActivityItem[] {
  return parseSegments(message.content).flatMap((segment) => {
    if (segment.type !== "block") return [];
    const state = message.tools?.[segment.index];
    return [{
      id: `${message.id}-${segment.index}`,
      messageId: message.id,
      label: LABELS[segment.block.kind] ?? "Realizó una acción",
      target: segment.block.target,
      status: state?.status ?? (message.streaming ? "running" : "saved"),
      durationMs: state?.durationMs ?? 0,
      file: segment.block.kind.startsWith("file:"),
    }];
  });
}

export function allActivity(messages: UIMessage[]) {
  return messages.flatMap(messageActivity);
}

export function activitySummary(message: UIMessage) {
  const items = messageActivity(message);
  return {
    items,
    durationMs: Math.max(message.thinkMs ?? 0, items.reduce((sum, item) => sum + item.durationMs, 0)),
    files: new Set(items.filter((item) => item.file && item.target).map((item) => item.target)).size,
    running: message.streaming || items.some((item) => item.status === "running" || item.status === "queued" || item.status === "pending"),
  };
}
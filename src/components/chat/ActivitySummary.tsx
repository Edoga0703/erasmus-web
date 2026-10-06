import { Activity, CheckCircle2, ChevronDown, Clock3, FileText, Loader2 } from "lucide-react";
import { Tool } from "@/components/ai-elements/tool";
import { CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { activitySummary } from "@/lib/activity";
import type { UIMessage } from "@/hooks/use-chat";
import { ToolCard } from "./ToolCard";

const fmt = (ms: number) => {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

export function ActivitySummary({ message }: { message: UIMessage }) {
  const summary = activitySummary(message);
  const blocks = messageActivityBlocks(message);
  if (!blocks.length) return null;
  return (
    <Tool defaultOpen={false} className="my-3 overflow-hidden rounded-xl border-e-line bg-e-bg2">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-e-bg3">
        {summary.running ? <Loader2 className="size-3.5 shrink-0 animate-spin text-e-dim" /> : <CheckCircle2 className="size-3.5 shrink-0 text-e-ok" />}
        <span className="font-medium">{summary.running ? "Erasmus está trabajando" : "Actividad completada"}</span>
        <span className="min-w-0 flex-1 truncate text-e-dim">
          {summary.items.length} {summary.items.length === 1 ? "paso" : "pasos"}
          {summary.files ? ` · ${summary.files} ${summary.files === 1 ? "archivo" : "archivos"}` : ""}
          {summary.durationMs ? ` · ${fmt(summary.durationMs)}` : ""}
        </span>
        <ChevronDown className="size-4 shrink-0 text-e-dim transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-e-line px-2 pb-2">
        {blocks.map(({ index, block }) => <ToolCard key={index} block={block} state={message.tools?.[index]} streaming={message.streaming} compact />)}
      </CollapsibleContent>
    </Tool>
  );
}

function messageActivityBlocks(message: UIMessage) {
  const { parseSegments } = requireBlocks();
  return parseSegments(message.content).flatMap((segment) => segment.type === "block" ? [{ index: segment.index, block: segment.block }] : []);
}

function requireBlocks() {
  return { parseSegments: (content: string) => {
    const out: { type: "block"; index: number; block: import("@/lib/blocks").ToolBlock }[] = [];
    const pattern = /```(code:python|code:bash|file:list|file:read|file:write|file:append)([^\n]*)\n([\s\S]*?)(?:```|$)/gi;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = pattern.exec(content))) {
      const kind = match[1] as import("@/lib/blocks").BlockKind;
      const body = (match[3] ?? "").replace(/\n$/, "");
      const arg = (match[2] ?? "").trim();
      const target = kind.startsWith("code:") ? body.trim().split("\n")[0] ?? "" : (kind === "file:write" || kind === "file:append" ? arg : body.trim().split("\n")[0] ?? "");
      out.push({ type: "block", index: index++, block: { kind, body, target, closed: content.indexOf("```", (match.index ?? 0) + 3) >= 0 } });
    }
    return out;
  }};
}
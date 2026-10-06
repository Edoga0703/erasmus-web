import { Activity, CheckCircle2, ChevronDown, Clock3, FileText, Loader2 } from "lucide-react";
import { Tool } from "@/components/ai-elements/tool";
import { CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { activitySummary } from "@/lib/activity";
import type { UIMessage } from "@/hooks/use-chat";
import { ToolCard } from "./ToolCard";
import { parseSegments } from "@/lib/blocks";

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
  return parseSegments(message.content).flatMap((segment) => segment.type === "block" ? [{ index: segment.index, block: segment.block }] : []);
}
import { useMemo } from "react";
import { parseSegments } from "@/lib/blocks";
import type { UIMessage } from "@/hooks/use-chat";
import { Markdown } from "./Markdown";
import { ToolCard } from "./ToolCard";
import { ThinkingChip } from "./Thinking";

export function MessageView({ m }: { m: UIMessage }) {
  const segs = useMemo(() => (m.role === "assistant" ? parseSegments(m.content) : []), [m.content, m.role]);
  if (m.hidden) return null;

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-e-bg3 px-4 py-2.5 text-e-tx">{m.content}</div>
      </div>
    );
  }

  const empty = !m.content.trim();
  return (
    <div className="text-e-tx">
      {((empty && m.streaming) || m.reasoning) && <ThinkingChip since={m.ts} active={!!m.streaming && empty} reasoning={m.reasoning} />}
      {segs.map((s, i) =>
        s.type === "text" ? (
          s.text.trim() ? <Markdown key={i} source={s.text} streaming={m.streaming} /> : null
        ) : (
          <ToolCard key={i} block={s.block} state={m.tools?.[s.index]} streaming={m.streaming} />
        ),
      )}
      {m.streaming && !empty && <span className="e-caret" />}
    </div>
  );
}

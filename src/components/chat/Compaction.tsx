import { useEffect, useState } from "react";
import { Layers } from "lucide-react";

export interface CompactionState { status: "running" | "done" | "error"; startedAt: number; ms?: number | undefined }

/** Inline chat line shown while the history is being summarized, with a live seconds counter. */
export function CompactionLine({ c }: { c: CompactionState }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (c.status !== "running") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [c.status]);
  const secs = Math.max(0, Math.round(((c.status === "running" ? now - c.startedAt : c.ms ?? 0)) / 1000));
  const label = c.status === "running" ? `Compactando conversación… ${secs} s` : c.status === "done" ? `Conversación compactada en ${secs} s` : "No se pudo compactar la conversación";
  return (
    <div className="my-1 flex items-center gap-3 text-[13px] text-e-dim" data-compaction={c.status} role="status">
      <span className="h-px flex-1 bg-e-line" />
      <span className={`inline-flex items-center gap-1.5 tabular-nums ${c.status === "running" ? "animate-pulse" : ""}`}>
        <Layers className="size-3.5" /> {label}
      </span>
      <span className="h-px flex-1 bg-e-line" />
    </div>
  );
}

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const fmt = (ms: number) => { const s = Math.max(1, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; };

/** ChatGPT-style reasoning header: live "Pensando…" while it streams, then a collapsible "Pensó durante N s". */
export function ThinkingChip({ since, active, reasoning, thinkMs, streaming }: { since: number; active: boolean; reasoning?: string | undefined; thinkMs?: number | undefined; streaming?: boolean | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const live = active || (!!streaming && !thinkMs);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [live]);
  const label = live ? (reasoning ? "Pensando…" : "Trabajando…") : thinkMs ? `Pensó durante ${fmt(thinkMs)}` : "Razonamiento";
  return (
    <div className="mb-3" data-thinking={live ? "live" : "done"}>
      <button type="button" onClick={() => reasoning && setOpen((o) => !o)} aria-expanded={open} aria-live="polite"
        className="inline-flex items-center gap-1 text-[14px] text-e-dim hover:text-e-tx">
        <span className={live ? "e-think-shimmer" : ""}>{label}</span>
        {live && <span className="font-mono text-[12px] tabular-nums">{((now - since) / 1000).toFixed(0)} s</span>}
        {reasoning && (open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
      </button>
      {reasoning && open && (
        <div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap border-l-2 border-e-line pl-4 text-[13.5px] leading-6 text-e-dim">{reasoning}</div>
      )}
    </div>
  );
}

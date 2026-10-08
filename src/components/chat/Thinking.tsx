import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (ms: number) => { const s = Math.max(1, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; };

/** ChatGPT/DeepSeek-style reasoning accordion: live shimmer pill, then a collapsed "Pensó durante N s ▾". */
export function ThinkingChip({ since, active, reasoning, thinkMs, streaming }: { since: number; active: boolean; reasoning?: string | undefined; thinkMs?: number | undefined; streaming?: boolean | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const live = !thinkMs && (active || !!streaming);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [live]);
  const secs = Math.max(0, Math.round((now - since) / 1000));
  return (
    <div className="mb-3" data-thinking={live ? "live" : "done"}>
      {live ? (
        <div aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full border border-e-line bg-e-bg3 px-3 py-1 text-[13.5px] text-e-dim">
          <span className="e-think-shimmer">{reasoning ? "Pensando…" : "Trabajando…"}</span>
          <span className="font-mono text-[12px] tabular-nums">{secs} s</span>
        </div>
      ) : (
        <button type="button" onClick={() => reasoning && setOpen((o) => !o)} aria-expanded={open}
          className="inline-flex items-center gap-1 text-[14px] text-e-dim hover:text-e-tx">
          <span>{thinkMs ? `Pensó durante ${fmt(thinkMs)}` : "Razonamiento"}</span>
          {reasoning && <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />}
        </button>
      )}
      {reasoning && !live && (
        <div className={cn("grid transition-all duration-300 ease-out", open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
          <div className="overflow-hidden">
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap border-l-2 border-e-line pl-4 text-[13.5px] leading-6 text-e-dim">{reasoning}</div>
          </div>
        </div>
      )}
    </div>
  );
}

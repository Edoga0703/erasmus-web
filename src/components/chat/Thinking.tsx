import { useEffect, useState } from "react";

/** "✦ trabajando…" chip with a live stopwatch while no content tokens have arrived. */
export function ThinkingChip({ since, active, reasoning }: { since: number; active: boolean; reasoning?: string | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [active]);
  const secs = ((now - since) / 1000).toFixed(1);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => reasoning && setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-e-line bg-e-bg3 px-3 py-1 text-[12px] text-e-dim"
        aria-expanded={open}
        aria-live="polite"
      >
        <span className={active ? "e-think-star" : ""}>✦</span>
        {active ? <>trabajando… <span className="font-mono tabular-nums">{secs}s</span></> : "razonamiento"}
        {reasoning && <span className="text-[10px]">{open ? "▴" : "▾"}</span>}
      </button>
      {reasoning && open && (
        <div className="mt-2 whitespace-pre-wrap border-l-2 border-e-line pl-3 text-[12.5px] italic text-e-dim">{reasoning}</div>
      )}
    </div>
  );
}

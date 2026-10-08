import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function AppSplash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setGone(true), 300);
    return () => window.clearTimeout(timer);
  }, [ready]);
  if (gone) return null;
  return <div role="status" aria-label="Iniciando espacio de trabajo" className={cn("fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-e-bg2 text-e-tx transition-opacity duration-300 motion-reduce:transition-none", ready ? "pointer-events-none opacity-0" : "opacity-100")}>
    <span className="e-splash-logo grid size-14 place-items-center rounded-full bg-e-acc text-2xl font-bold text-e-bg2" aria-hidden="true">E</span>
    <p className="text-[13px] text-e-dim">Iniciando espacio de trabajo...</p>
  </div>;
}
import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Acc { plan: string; balance: number; used: number; images?: number; quota?: number; inflight?: number }
const n = (v: number) => v.toLocaleString("es-ES");
const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} M` : v >= 1e3 ? `${Math.round(v / 1e3)} k` : String(v));

let accountEndpointUnsupported = false;
const MIN_TURN_REFRESH_MS = 10_000;

/** Plan usage pill in the header; refreshes after every turn (with throttle) or immediately on session/coupon change. Warns when <10 % of tokens remain. */
export function UsageMeter() {
  const [acc, setAcc] = useState<Acc | null>(null);
  const lastFetchedAt = useRef(0);
  const load = useCallback(async (force = false) => {
    if (accountEndpointUnsupported && !force) return;
    const now = Date.now();
    if (!force && now - lastFetchedAt.current < MIN_TURN_REFRESH_MS) return;
    lastFetchedAt.current = now;
    try {
      const a = await api.account();
      accountEndpointUnsupported = false;
      setAcc({ plan: a.plan || "—", balance: a.tokens_balance, used: a.tokens_used, images: a.images_used, ...(a.images_quota ? { quota: a.images_quota } : {}), inflight: a.inflight });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
        accountEndpointUnsupported = true;
      }
      /* hidden when the account is not reachable */
    }
  }, []);
  useEffect(() => {
    void load(true);
    const onTurn = () => void load(false);
    const onForce = () => { accountEndpointUnsupported = false; void load(true); };
    window.addEventListener("erasmus:turn-done", onTurn);
    window.addEventListener("erasmus:model-config", onForce);
    window.addEventListener("erasmus:session", onForce);
    window.addEventListener("erasmus:session-changed", onForce);
    return () => {
      window.removeEventListener("erasmus:turn-done", onTurn);
      window.removeEventListener("erasmus:model-config", onForce);
      window.removeEventListener("erasmus:session", onForce);
      window.removeEventListener("erasmus:session-changed", onForce);
    };
  }, [load]);
  if (!acc) return null;
  const total = acc.balance + acc.used;
  const pct = total > 0 ? Math.min(100, (acc.used / total) * 100) : 0;
  const low = total > 0 && acc.balance / total < 0.1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] hover:bg-e-bg3", low ? "text-e-err" : "text-e-dim")} aria-label="Uso del plan" data-usage-meter>
          <Gauge className="size-4" /><span className="hidden tabular-nums sm:inline">{short(acc.balance)} disponibles</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="e-pop w-72 p-4 text-[13.5px]">
        <div className="flex items-baseline justify-between"><span className="font-medium">Uso del plan</span><span className="text-e-dim">Plan {({ free: "gratuito", pro: "Pro", plus: "Plus" } as Record<string, string>)[acc.plan.toLowerCase()] ?? acc.plan}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-e-bg3"><div className={cn("h-full rounded-full", low ? "bg-e-err" : "bg-e-acc")} style={{ width: `${pct}%` }} /></div>
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between"><span className="text-e-dim">Tokens disponibles</span><span className="tabular-nums">{n(acc.balance)}</span></div>
          <div className="flex justify-between"><span className="text-e-dim">Tokens usados</span><span className="tabular-nums">{n(acc.used)}</span></div>
          {acc.images !== undefined && <div className="flex justify-between"><span className="text-e-dim">Imágenes</span><span className="tabular-nums">{n(acc.images)}{acc.quota ? ` de ${n(acc.quota)}` : ""}</span></div>}
          {acc.inflight !== undefined && <div className="flex justify-between"><span className="text-e-dim">Respuestas en curso</span><span className="tabular-nums">{acc.inflight}</span></div>}
        </div>
        {low && <p className="mt-3 text-[12.5px] text-e-err">Te quedan pocos tokens en tu plan.</p>}
      </PopoverContent>
    </Popover>
  );
}

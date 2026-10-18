import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Gauge, Ticket } from "lucide-react";
import { api, ApiError, normalizeTs } from "@/lib/api/client";
import { getSession } from "@/lib/session";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AccountSnapshot {
  plan: string;
  balance: number;
  used: number;
  images?: number | undefined;
  quota?: number | undefined;
  inflight?: number | undefined;
  expiresAt: number;
}

const n = (v: number) => v.toLocaleString("es-ES");
const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")} M` : v >= 1e3 ? `${Math.round(v / 1e3)} k` : String(v));

export function formatPlanName(plan: string): string {
  const map: Record<string, string> = {
    free: "Gratuito",
    pro: "Pro",
    enterprise: "Enterprise",
    plus: "Plus",
  };
  return map[plan.toLowerCase()] ?? (plan || "Estándar");
}

export function formatPlanExpiry(expiresMs: number): { label: string; dateStr: string; urgent: boolean; expired: boolean; days: number } | null {
  if (!Number.isFinite(expiresMs) || expiresMs <= 0) return null;
  const dateStr = new Date(expiresMs).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const diffMs = expiresMs - Date.now();
  if (diffMs <= 0) {
    return { label: "Vencido", dateStr, urgent: true, expired: true, days: 0 };
  }
  if (diffMs < 86_400_000) {
    const hours = Math.max(1, Math.ceil(diffMs / 3_600_000));
    return { label: `Vence hoy (${hours} h)`, dateStr, urgent: true, expired: false, days: 1 };
  }
  const days = Math.ceil(diffMs / 86_400_000);
  return {
    label: days <= 5 ? `Vence en ${days} días` : `${days} días restantes`,
    dateStr,
    urgent: days <= 5,
    expired: false,
    days,
  };
}

let accountEndpointUnsupported = false;
const MIN_TURN_REFRESH_MS = 10_000;

/** Plan usage pill in the header; refreshes after every turn (with throttle) or immediately on session/coupon change. Warns when <10 % of tokens remain or plan expires soon. */
export function UsageMeter() {
  const [acc, setAcc] = useState<AccountSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const lastFetchedAt = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (force = false): Promise<void> => {
    if (accountEndpointUnsupported && !force) return;
    const now = Date.now();
    const wait = MIN_TURN_REFRESH_MS - (now - lastFetchedAt.current);
    if (!force && wait > 0) {
      // Throttled: schedule one trailing refresh so the final turn is not lost.
      if (!trailing.current) trailing.current = setTimeout(() => { trailing.current = null; void load(false); }, wait);
      return;
    }
    if (trailing.current) { clearTimeout(trailing.current); trailing.current = null; }
    lastFetchedAt.current = now;
    try {
      const a = await api.account();
      accountEndpointUnsupported = false;
      const sess = getSession();
      const balance = Number(a.tokens_balance ?? a.balance_tokens ?? 0);
      const used = Number(a.tokens_used ?? 0);
      const expiresAt = normalizeTs(a.expires_at ?? a.expires, sess?.expires ?? 0);
      setAcc({
        plan: a.plan || sess?.plan || "—",
        balance,
        used,
        images: a.images_used,
        ...(a.images_quota ? { quota: a.images_quota } : {}),
        inflight: a.inflight,
        expiresAt,
      });
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
      if (trailing.current) { clearTimeout(trailing.current); trailing.current = null; }
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
  const expiry = formatPlanExpiry(acc.expiresAt);
  const warn = low || Boolean(expiry?.urgent);

  const openDataSettings = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("erasmus:open-settings", { detail: "data" }));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] hover:bg-e-bg3", warn ? "text-e-err" : "text-e-dim")}
          aria-label="Uso del plan"
          data-usage-meter
        >
          <Gauge className="size-4" />
          <span className="hidden tabular-nums sm:inline">{short(acc.balance)} disponibles</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="e-pop w-80 p-4 text-[13.5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Estado de tu cuenta</span>
          <span className="rounded-full border border-e-line bg-e-bg3 px-2.5 py-0.5 text-[12px] font-medium text-e-tx">
            Plan {formatPlanName(acc.plan)}
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-e-bg3">
          <div className={cn("h-full rounded-full transition-all", low ? "bg-e-err" : "bg-e-acc")} style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-e-dim">Tokens disponibles</span>
            <span className="font-medium tabular-nums text-e-tx">{n(acc.balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-e-dim">Tokens usados</span>
            <span className="tabular-nums">{n(acc.used)}</span>
          </div>
          {acc.images !== undefined && (
            <div className="flex justify-between">
              <span className="text-e-dim">Imágenes</span>
              <span className="tabular-nums">{n(acc.images)}{acc.quota ? ` de ${n(acc.quota)}` : ""}</span>
            </div>
          )}
          {acc.inflight !== undefined && (
            <div className="flex justify-between">
              <span className="text-e-dim">Respuestas en curso</span>
              <span className="tabular-nums">{acc.inflight}</span>
            </div>
          )}
          {expiry && (
            <div className="flex items-center justify-between border-t border-e-line pt-2">
              <span className="inline-flex items-center gap-1 text-e-dim">
                <CalendarClock className="size-3.5" /> Vigencia
              </span>
              <span className={cn("text-right text-[12.5px]", expiry.urgent ? "font-medium text-e-err" : "text-e-tx")}>
                {expiry.label} <span className="text-e-dim">({expiry.dateStr})</span>
              </span>
            </div>
          )}
        </div>

        {low && <p className="mt-2.5 text-[12px] text-e-err">Te quedan pocos tokens disponibles en tu plan.</p>}
        {expiry?.expired && <p className="mt-2 text-[12px] text-e-err">Tu plan ha vencido. Canjea un cupón para renovarlo.</p>}

        <button
          type="button"
          onClick={openDataSettings}
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-e-line bg-e-bg3 py-2 text-[12.5px] font-medium text-e-tx hover:bg-e-bg4"
        >
          <Ticket className="size-3.5" /> Ver cuenta y canjear cupón
        </button>
      </PopoverContent>
    </Popover>
  );
}

import { apiFetch } from "@/lib/api/client";
import { CODE_RE, clearSession, getSession, setSession, type UserSession } from "@/lib/session";

export type LoginResult = { ok: true } | { ok: false; reason: "format" | "invalid" | "rate" | "unavailable" | "network"; retryAfter?: number };
export interface CouponClaim { session: string; accessCode: string; userId: string; plan: string; expires: number; message: string }
export type CouponResult = { ok: true; claim: CouponClaim } | { ok: false; message: string };

/** Dev-only escape hatch so the editor preview stays usable while the server lacks /api/auth/*. Never in a production build. */
export const DEV_LOCAL_LOGIN = import.meta.env.DEV;

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST /api/auth/login {code} → {session, user_id, plan, expires}. PROPOSED (INTEGRATION_NOTES.md). */
export async function login(code: string): Promise<LoginResult> {
  if (!CODE_RE.test(code)) return { ok: false, reason: "format" };
  let res: Response;
  try {
    res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ code }) });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.ok) {
    const j = (await res.json().catch(() => null)) as { session?: string; user_id?: string; plan?: string; expires?: number | string } | null;
    if (!j?.session || !j.user_id) return { ok: false, reason: "unavailable" };
    const numeric = typeof j.expires === "number" ? j.expires : Number.NaN;
    const iso = typeof j.expires === "string" ? Date.parse(j.expires) : Number.NaN;
    const exp = Number.isFinite(iso) ? iso : numeric > 1e12 ? numeric : numeric > 0 ? numeric * 1000 : Date.now() + 12 * 3600_000;
    setSession({ token: j.session, userId: j.user_id, plan: j.plan ?? "", expires: exp });
    return { ok: true };
  }
  if (res.status === 429) return { ok: false, reason: "rate", retryAfter: Number(res.headers.get("Retry-After")) || 30 };
  if (res.status === 401 || res.status === 403) return { ok: false, reason: "invalid" };
  if ((res.status === 404 || res.status === 503) && DEV_LOCAL_LOGIN) {
    // Dev preview only: the user id is derived from the code so each code gets its own isolated space.
    const userId = "dev_" + (await sha256(code)).slice(0, 24);
    setSession({ token: "", userId, plan: "desarrollo", expires: Date.now() + 12 * 3600_000, local: true });
    return { ok: true };
  }
  return { ok: false, reason: "unavailable" };
}

/** Redeems a one-use coupon and starts the newly-created account session. */
export async function claimCoupon(code: string): Promise<CouponResult> {
  try {
    const res = await apiFetch("/api/coupons/claim_new", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) });
    const j = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false, message: String((j?.["error"] as Record<string, unknown> | undefined)?.["message"] ?? "No se pudo canjear el cupón.") };
    if (!j || typeof j["session"] !== "string" || typeof j["user_id"] !== "string" || typeof j["access_code"] !== "string") return { ok: false, message: "El servidor devolvió una respuesta incompleta." };
    const expires = Date.parse(String(j["expires_at"] ?? ""));
    const claim = { session: j["session"], accessCode: j["access_code"], userId: j["user_id"], plan: String(j["plan"] ?? "pro"), expires: Number.isFinite(expires) ? expires : Date.now() + 12 * 3600_000, message: String(j["message"] ?? "Cupón canjeado.") };
    setSession({ token: claim.session, userId: claim.userId, plan: claim.plan, expires: claim.expires });
    return { ok: true, claim };
  } catch {
    return { ok: false, message: "No se pudo conectar con el servidor." };
  }
}

export async function logout(): Promise<void> {
  const s = getSession();
  if (s && !s.local) { try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* best effort */ } }
  clearSession();
}

export type { UserSession };

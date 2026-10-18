import { apiFetch, normalizeTs } from "@/lib/api/client";
import { CODE_RE, clearSession, getSession, setSession, type UserSession } from "@/lib/session";

export type LoginResult = { ok: true } | { ok: false; reason: "format" | "invalid" | "rate" | "unavailable" | "network"; retryAfter?: number };
export interface CouponClaim { session: string; accessCode: string; userId: string; plan: string; expires: number; message: string }
export type CouponResult = { ok: true; claim: CouponClaim } | { ok: false; message: string };

/** POST /api/auth/login {code} → an authenticated Erasmus session. */
export async function login(code: string): Promise<LoginResult> {
  if (!CODE_RE.test(code)) return { ok: false, reason: "format" };
  let res: Response;
  try {
    res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ code }) });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.ok) {
    const j = (await res.json().catch(() => null)) as { session?: string; user_id?: string; plan?: string; expires?: number | string; expires_at?: number | string } | null;
    if (!j?.session || !j.user_id) return { ok: false, reason: "unavailable" };
    const exp = normalizeTs(j.expires ?? j.expires_at, Date.now() + 12 * 3600_000);
    setSession({ token: j.session, userId: j.user_id, plan: j.plan ?? "", expires: exp });
    return { ok: true };
  }
  if (res.status === 429) return { ok: false, reason: "rate", retryAfter: Number(res.headers.get("Retry-After")) || 30 };
  if (res.status === 401 || res.status === 403) return { ok: false, reason: "invalid" };
  return { ok: false, reason: "unavailable" };
}

/** Redeems a one-use new-user coupon (/api/coupons/claim_new) and starts the newly-created account session. */
export async function claimCoupon(code: string): Promise<CouponResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { ok: false, message: "Introduce un código de cupón válido." };
  try {
    const res = await apiFetch("/api/coupons/claim_new", { method: "POST", body: JSON.stringify({ code: cleanCode }) });
    const j = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) {
      const errObj = j?.["error"];
      const errMsg = typeof errObj === "object" && errObj !== null
        ? (errObj as Record<string, unknown>)["message"]
        : typeof errObj === "string"
          ? errObj
          : j?.["message"];
      return { ok: false, message: String(errMsg ?? "No se pudo canjear el cupón.") };
    }
    const rawAccessCode = j?.["access_code"] ?? j?.["code"] ?? j?.["key"] ?? (typeof j?.["user_id"] === "string" && CODE_RE.test(j["user_id"]) ? j["user_id"] : undefined);
    if (!j || typeof rawAccessCode !== "string" || !rawAccessCode.trim()) {
      return { ok: false, message: "El servidor devolvió una respuesta incompleta." };
    }
    const accessCode = rawAccessCode.trim();
    const plan = String(j["plan"] ?? "pro");
    const expires = normalizeTs(j["expires_at"] ?? j["expires"], Date.now() + 12 * 3600_000);
    const message = String(j["message"] ?? "Cupón canjeado con éxito.");

    if (typeof j["session"] === "string" && j["session"] && typeof j["user_id"] === "string" && j["user_id"]) {
      setSession({ token: j["session"], userId: j["user_id"], plan, expires });
      return { ok: true, claim: { session: j["session"], accessCode, userId: j["user_id"], plan, expires, message } };
    }

    // If the gateway returned only the generated erm-... access code, sign in automatically to create the session.
    const loginRes = await login(accessCode);
    const currentSession = getSession();
    if (loginRes.ok && currentSession) {
      return {
        ok: true,
        claim: {
          session: currentSession.token,
          accessCode,
          userId: currentSession.userId,
          plan: currentSession.plan || plan,
          expires: currentSession.expires || expires,
          message,
        },
      };
    }
    return { ok: false, message: "El cupón generó tu clave, pero no se pudo iniciar sesión automáticamente." };
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

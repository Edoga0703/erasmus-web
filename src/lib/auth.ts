import { apiFetch } from "@/lib/api/client";
import { CODE_RE, clearSession, getSession, setSession, type UserSession } from "@/lib/session";

export type LoginResult = { ok: true } | { ok: false; reason: "format" | "invalid" | "rate" | "unavailable" | "network"; retryAfter?: number };

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
    const j = (await res.json().catch(() => null)) as { session?: string; user_id?: string; plan?: string; expires?: number } | null;
    if (!j?.session || !j.user_id) return { ok: false, reason: "unavailable" };
    const exp = Number(j.expires);
    setSession({ token: j.session, userId: j.user_id, plan: j.plan ?? "", expires: exp > 1e12 ? exp : exp > 0 ? exp * 1000 : Date.now() + 12 * 3600_000 });
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

export async function logout(): Promise<void> {
  const s = getSession();
  if (s && !s.local) { try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* best effort */ } }
  clearSession();
}

export type { UserSession };

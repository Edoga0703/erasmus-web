/**
 * User session (login por código erm-…). The server is the only authority: it validates the
 * code and returns an opaque session token. The browser keeps that token in sessionStorage and
 * namespaces every piece of local data with the user id so two users can never read each other's.
 */
export interface UserSession { token: string; userId: string; plan: string; expires: number; local?: boolean }

const SESSION_KEY = "erasmus.session.v1";
const LOGOUT_SIGNAL = "erasmus.logout.signal";
/** Unscoped keys written by older builds: wiped on first run so nothing leaks into a user namespace. */
const LEGACY_KEYS = ["erasmus.active-chat.v1", "erasmus.custom.v1", "erasmus.model.cfg", "erasmus.model.key", "erasmus.ctx.override", "erasmus_bridge_token"];

/** erm-XXXX-XXXX-XXXXX-XXXX (letras y números). */
export const CODE_RE = /^erm-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{5}-[A-Za-z0-9]{4}$/;
const GROUPS = [4, 4, 5, 4];

/** Formats free typing/pasting into erm-XXXX-XXXX-XXXXX-XXXX. */
export function formatCode(raw: string): string {
  let s = raw.trim().replace(/[^A-Za-z0-9]/g, "");
  if (/^erm/i.test(s)) s = s.slice(3);
  s = s.slice(0, 17);
  if (!s) return raw.trim().toLowerCase().startsWith("e") ? raw.trim().slice(0, 4).toLowerCase() : "";
  const parts: string[] = [];
  let i = 0;
  for (const g of GROUPS) { if (i >= s.length) break; parts.push(s.slice(i, i + g)); i += g; }
  return `erm-${parts.join("-")}`;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

let cache: UserSession | null | undefined;

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  if (cache !== undefined && (cache === null || cache.expires > Date.now())) return cache;
  try {
    const j = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as UserSession | null;
    cache = j && typeof j.token === "string" && SAFE_ID.test(String(j.userId)) && j.expires > Date.now() ? j : null;
    if (!cache) sessionStorage.removeItem(SESSION_KEY);
  } catch { cache = null; }
  return cache;
}

export function setSession(s: UserSession): void {
  if (!SAFE_ID.test(s.userId)) throw new Error("user_id inválido");
  const prev = getSession();
  if (prev && prev.userId !== s.userId) wipeUser(prev.userId);
  wipeLegacy();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  cache = s;
  window.dispatchEvent(new Event("erasmus:session"));
}

/** Clears the session and every byte stored for that user in this browser. */
export function clearSession(): void {
  const s = getSession();
  if (s) wipeUser(s.userId);
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* */ }
  cache = null;
  try { localStorage.setItem(LOGOUT_SIGNAL, String(Date.now())); } catch { /* */ }
  window.dispatchEvent(new Event("erasmus:session"));
}

/** Namespaced storage key for the signed-in user. Without a session returns a key nothing reads. */
export function userKey(k: string): string {
  const s = getSession();
  return `erasmus:${s ? s.userId : "_anon"}:${k}`;
}

function wipeUser(userId: string) {
  const prefix = `erasmus:${userId}:`;
  for (const store of [localStorage, sessionStorage]) {
    try {
      const del: string[] = [];
      for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k?.startsWith(prefix) || k?.startsWith("erasmus:_anon:")) del.push(k); }
      del.forEach((k) => store.removeItem(k));
    } catch { /* */ }
  }
}

function wipeLegacy() {
  for (const k of LEGACY_KEYS) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* */ } }
}

/** Another tab signed out on this browser → this tab signs out too. Returns unsubscribe. */
export function onForeignLogout(cb: () => void): () => void {
  const h = (e: StorageEvent) => { if (e.key === LOGOUT_SIGNAL && getSession()) { clearSessionLocalOnly(); cb(); } };
  window.addEventListener("storage", h);
  return () => window.removeEventListener("storage", h);
}
function clearSessionLocalOnly() {
  const s = getSession();
  if (s) wipeUser(s.userId);
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* */ }
  cache = null;
}

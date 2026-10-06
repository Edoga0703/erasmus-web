import { userKey } from "@/lib/session";
/** Single source of truth for the API base URL and mock switch. */
export const API_BASE: string = String(import.meta.env['VITE_API_BASE'] ?? "/erasmus-api").replace(/\/+$/, "");
/** Direct-to-model mode: set while the bridge is not yet deployed. Chat/models/account go straight to the model server; sandbox/files/history degrade. */
export const MODEL_BASE: string = String(import.meta.env['VITE_MODEL_BASE'] ?? "").replace(/\/+$/, "");
export const DIRECT: boolean = MODEL_BASE !== "";

const TOKEN_KEY = "erasmus_bridge_token";

/** Captures ?t=<token> into sessionStorage and strips it from the URL. Call from useEffect. */
export function captureTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t) {
      sessionStorage.setItem(TOKEN_KEY, t);
      params.delete("t");
      const qs = params.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (qs ? `?${qs}` : ""));
    }
  } catch {
    /* storage unavailable */
  }
}

let captured = false;

export function getToken(): string {
  if (typeof window === "undefined") return "";
  if (!captured) {
    captured = true;
    captureTokenFromUrl();
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Manual bridge-token entry (Ajustes → Conexión) for when the app is opened without ?t=. sessionStorage only. */
export function setToken(t: string): void {
  try { if (t.trim()) sessionStorage.setItem(TOKEN_KEY, t.trim()); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ }
}

/* ---- Model connection settings (API_Erasmus.md §2) ---- */
export type ReasoningEffort = "none" | "low" | "medium" | "high";
export interface ModelConfig { apiKey: string; remember: boolean; model: string; reasoning: ReasoningEffort; compact: boolean }
const CFG_KEY = () => userKey("model.cfg");
const KEY_KEY = () => userKey("model.key");
export const DEFAULT_MODEL_CFG: ModelConfig = { apiKey: "", remember: false, model: "erasmus-v1", reasoning: "medium", compact: false };

/** The bridge only forwards Bearer keys that start with "ms-" and are longer than 10 chars. */
export const isValidVpsKey = (k: string) => k.startsWith("ms-") && k.length > 10;

export function getModelConfig(): ModelConfig {
  if (typeof window === "undefined") return DEFAULT_MODEL_CFG;
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY()) ?? "{}") as Partial<ModelConfig>;
    const apiKey = sessionStorage.getItem(KEY_KEY()) ?? "";
    return { ...DEFAULT_MODEL_CFG, ...raw, remember: false, apiKey };
  } catch { return DEFAULT_MODEL_CFG; }
}

/** The key only ever lives in sessionStorage (gone when the tab closes); it is never written to localStorage or the config blob. */
export function saveModelConfig(c: ModelConfig): void {
  try {
    const { apiKey, remember: _r, ...rest } = c;
    localStorage.setItem(CFG_KEY(), JSON.stringify(rest));
    localStorage.removeItem(KEY_KEY());
    if (apiKey) sessionStorage.setItem(KEY_KEY(), apiKey); else sessionStorage.removeItem(KEY_KEY());
    window.dispatchEvent(new Event("erasmus:model-config"));
  } catch { /* */ }
}

/** Masked form for display: never show the full key. */
export const maskKey = (k: string) => (k ? `ms-…${k.slice(-4)}` : "");

/** Display-only brand name: internal upstream ids are never shown to users (the value sent to the server is unchanged). */
export function displayModel(id: string | undefined | null): string {
  const s = String(id ?? "");
  if (!s || /drael/i.test(s) || /^erasmus/i.test(s)) return "Erasmus";
  return s;
}

/** Personalización: instrucciones del usuario que se añaden como mensaje de sistema en cada conversación. */
export interface CustomInstructions { about: string; style: string }
const CUSTOM_KEY = () => userKey("custom.v1");
export function getCustomInstructions(): CustomInstructions {
  try { const j = JSON.parse(localStorage.getItem(CUSTOM_KEY()) ?? "null"); return { about: String(j?.about ?? ""), style: String(j?.style ?? "") }; } catch { return { about: "", style: "" }; }
}
export function saveCustomInstructions(c: CustomInstructions): void {
  try { localStorage.setItem(CUSTOM_KEY(), JSON.stringify({ about: c.about.slice(0, 1500), style: c.style.slice(0, 1500) })); } catch { /* */ }
}
export function customSystemText(): string {
  const c = getCustomInstructions();
  const parts = [c.about.trim() && `Lo que el usuario quiere que sepas de él o de su empresa:\n${c.about.trim()}`, c.style.trim() && `Cómo quiere que respondas:\n${c.style.trim()}`].filter(Boolean);
  return parts.length ? `Instrucciones personalizadas del usuario:\n\n${parts.join("\n\n")}` : "";
}

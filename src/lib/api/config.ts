/** Single source of truth for the API base URL and mock switch. */
export const API_BASE: string = String(import.meta.env['VITE_API_BASE'] ?? "/erasmus-api").replace(/\/+$/, "");
export const MOCK: boolean = import.meta.env['VITE_MOCK'] === "1";
/** Direct-to-model mode: set while the bridge is not yet deployed. Chat/models/account go straight to the model server; sandbox/files/history degrade. */
export const MODEL_BASE: string = String(import.meta.env['VITE_MODEL_BASE'] ?? "").replace(/\/+$/, "");
export const DIRECT: boolean = !MOCK && MODEL_BASE !== "";

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
    } else if (MOCK && !sessionStorage.getItem(TOKEN_KEY)) {
      // Mock-only demo token so the preview is navigable; never used in real mode.
      sessionStorage.setItem(TOKEN_KEY, "mock-token");
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
const CFG_KEY = "erasmus.model.cfg";
const KEY_KEY = "erasmus.model.key";
export const DEFAULT_MODEL_CFG: ModelConfig = { apiKey: "", remember: false, model: "erasmus-v1", reasoning: "medium", compact: false };

/** The bridge only forwards Bearer keys that start with "ms-" and are longer than 10 chars. */
export const isValidVpsKey = (k: string) => k.startsWith("ms-") && k.length > 10;

export function getModelConfig(): ModelConfig {
  if (typeof window === "undefined") return DEFAULT_MODEL_CFG;
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) ?? "{}") as Partial<ModelConfig>;
    const apiKey = (raw.remember ? localStorage.getItem(KEY_KEY) : sessionStorage.getItem(KEY_KEY)) ?? "";
    return { ...DEFAULT_MODEL_CFG, ...raw, apiKey };
  } catch { return DEFAULT_MODEL_CFG; }
}

/** Key lives in sessionStorage unless "remember" is on; it is never written into the non-secret config blob. */
export function saveModelConfig(c: ModelConfig): void {
  try {
    const { apiKey, ...rest } = c;
    localStorage.setItem(CFG_KEY, JSON.stringify(rest));
    localStorage.removeItem(KEY_KEY); sessionStorage.removeItem(KEY_KEY);
    if (apiKey) (c.remember ? localStorage : sessionStorage).setItem(KEY_KEY, apiKey);
    window.dispatchEvent(new Event("erasmus:model-config"));
  } catch { /* */ }
}

/** Display-only brand name: internal upstream ids are never shown to users (the value sent to the server is unchanged). */
export function displayModel(id: string | undefined | null): string {
  const s = String(id ?? "");
  if (!s || /drael/i.test(s) || /^erasmus/i.test(s)) return "Erasmus";
  return s;
}

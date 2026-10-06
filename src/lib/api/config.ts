import { userKey } from "@/lib/session";
/** Single source of truth for the Erasmus v5.4 API. */
export const API_BASE: string = String(import.meta.env['VITE_API_BASE'] ?? "/erasmus-api").replace(/\/+$/, "");

/* ---- User-facing model preferences; access is assigned by the server session. ---- */
export type ReasoningEffort = "none" | "low" | "medium" | "high";
export interface ModelConfig { model: string; reasoning: ReasoningEffort }
const CFG_KEY = () => userKey("model.cfg");
export const DEFAULT_MODEL_CFG: ModelConfig = { model: "erasmus-v1", reasoning: "medium" };

export function getModelConfig(): ModelConfig {
  if (typeof window === "undefined") return DEFAULT_MODEL_CFG;
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY()) ?? "{}") as Partial<ModelConfig>;
    return { ...DEFAULT_MODEL_CFG, model: "erasmus-v1", reasoning: raw.reasoning ?? DEFAULT_MODEL_CFG.reasoning };
  } catch { return DEFAULT_MODEL_CFG; }
}

export function saveModelConfig(c: ModelConfig): void {
  try {
    localStorage.setItem(CFG_KEY(), JSON.stringify({ model: "erasmus-v1", reasoning: c.reasoning }));
    window.dispatchEvent(new Event("erasmus:model-config"));
  } catch { /* */ }
}

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

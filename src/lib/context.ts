import { userKey } from "@/lib/session";
import { api, ApiError } from "@/lib/api/client";

/** Fallback when /v1/models does not publish context_length. */
export const DEFAULT_CONTEXT = 200_000;
/** Proactive compaction threshold (fraction of the window) and space kept for the answer. */
export const COMPACT_AT = 0.8;
export const ANSWER_RESERVE = 8_000;
/** A single attachment above this fraction of the window is rejected before sending. */
export const FILE_MAX_FRACTION = 0.5;
export const KEEP_RECENT = 6;
const IMAGE_TOKENS = 1_500;
const OVERRIDE_KEY = () => userKey("ctx.override");

let cached: Promise<number> | null = null;

/** Context window in tokens (cached). localStorage override exists only for testing compaction. */
export function getContextLength(model?: string): Promise<number> {
  try {
    const o = Number(localStorage.getItem(OVERRIDE_KEY()));
    if (o > 0) return Promise.resolve(o);
  } catch { /* ignore */ }
  if (!cached) {
    cached = api.models()
      .then((r) => {
        const list = r.data ?? [];
        const m = list.find((d) => d.id === model) ?? list[0];
        return m?.context_length && m.context_length > 0 ? m.context_length : DEFAULT_CONTEXT;
      })
      .catch(() => { cached = null; return DEFAULT_CONTEXT; });
  }
  return cached;
}

/** Rough estimate: ~4 characters per token; images count as a fixed size. */
export function estimateTokens(content: string | unknown[]): number {
  if (typeof content === "string") return Math.ceil(content.length / 4);
  let n = 0;
  for (const p of content as { type?: string; text?: string }[]) n += p.type === "text" ? Math.ceil((p.text ?? "").length / 4) : IMAGE_TOKENS;
  return n;
}

export function historyTokens(msgs: { content: string | unknown[] }[]): number {
  return msgs.reduce((s, m) => s + estimateTokens(m.content) + 4, 0);
}

export function isContextOverflow(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  const s = `${e.code} ${e.message}`.toLowerCase();
  return /context_overflow|context_length|context length|maximum context|too many tokens|prompt is too long/.test(s);
}

export const COMPACT_PROMPT =
  "Resume la conversación anterior para poder continuarla sin ella. Conserva EXACTAMENTE cifras, importes, fechas, nombres de personas, empresas, productos y archivos, decisiones tomadas, preferencias del usuario y tareas pendientes. Escribe en el idioma de la conversación, en viñetas concisas, sin introducción ni comentarios.";

export const LIMIT_MSG = "Esta conversación alcanzó su límite y no puede continuar. Inicia una conversación nueva para seguir.";
export const FILE_TOO_BIG_MSG = "El archivo es demasiado grande para analizarlo de una vez. Divídelo en partes más pequeñas.";

import { API_BASE, customSystemText, getModelConfig } from "./config";
import type {
  ChatData,
  ChatMeta,
  ChatListResponse,
  FsListResponse,
  FsReadResponse,
  FsWriteResponse,
  ExecRequest,
  ExecResponse,
  StatusResponse,
  FilesResponse,
  AccountResponse,
  SessionProfile,
} from "./types";
import { clearSession, getSession } from "@/lib/session";
import type { ImageSize } from "@/lib/images";

/** Normalizes timestamps coming as epoch ms, epoch seconds (< 1e12), or ISO-8601 strings into epoch ms. */
export function normalizeTs(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? Math.round(value * 1000) : value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e12 ? Math.round(numeric * 1000) : numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

let rejectingSession = false;

/** Server says the session is no longer valid → wipe it locally once and go to the login page. */
function onSessionRejected() {
  if (rejectingSession) return;
  rejectingSession = true;
  clearSession();
  queueMicrotask(() => { rejectingSession = false; });
  if (typeof window !== "undefined" && window.location.pathname !== "/entrar") {
    window.location.assign("/entrar");
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** All private network I/O goes through here and is authorized by the current Erasmus session. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const session = getSession();
  if (session && !session.local) headers.set("X-Erasmus-Session", session.token);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && session && !session.local && path !== "/api/auth/login") onSessionRejected();
  return res;
}

async function parseError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = `Error ${res.status}`;
  try {
    const j = await res.json();
    if (j?.error && typeof j.error === "object") {
      code = j.error.code ?? code;
      message = j.error.message ?? message;
    } else if (typeof j?.error === "string") {
      code = j.error;
      message = j.message ?? j.error;
    }
  } catch {
    /* non-json */
  }
  if (res.status === 403) message = "No tienes permiso para realizar esta acción.";
  if (res.status === 401) message = "Tu sesión ya no es válida. Vuelve a entrar.";
  if (res.status === 402) {
    const lowerCode = code.toLowerCase();
    message = lowerCode.includes("token") || lowerCode.includes("balance") || lowerCode.includes("plan_expired")
      ? "Has agotado el saldo de tokens de tu plan."
      : "Has alcanzado el límite de imágenes de tu plan.";
  }
  if (res.status === 429) message = "Procesos en cola: esperando a desocuparse un cupo para continuar.";
  if (res.status === 502) message = "El modelo no respondió. Inténtalo de nuevo en unos segundos.";
  if (res.status === 503) {
    // Mantenimiento temporal del motor: si el servidor explica (p. ej. "Ajuste rápido"), se muestra tal cual; si no, mensaje claro sin expulsar la sesión.
    message = message.trim() && message !== `Error ${res.status}`
      ? message.trim()
      : "El motor de inferencia está en ajuste temporal. Vuelve a intentarlo en unos minutos.";
  }
  return new ApiError(res.status, code, message);
}

const DEFAULT_JSON_TIMEOUT_MS = 25_000;

export async function apiJson<T>(
  path: string,
  body?: unknown,
  method?: "GET" | "POST" | "DELETE",
  signal?: AbortSignal,
  timeoutMs = DEFAULT_JSON_TIMEOUT_MS,
): Promise<T> {
  const ctrl = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs) : undefined;
  try {
    let res: Response;
    try {
      // Always use our controller so the timeout also applies when the caller passes a signal.
      const init: RequestInit = { method: method ?? (body === undefined ? "GET" : "POST"), signal: ctrl.signal };
      if (body !== undefined) init.body = JSON.stringify(body);
      res = await apiFetch(path, init);
    } catch (e) {
      if (timedOut) throw new ApiError(408, "request_timeout", "Tiempo de espera agotado.");
      if (signal?.aborted) throw e;
      throw new ApiError(0, "network", "No se pudo conectar con Erasmus.");
    }
    // Body consumption stays under the same timeout.
    try {
      if (!res.ok) throw await parseError(res);
      return (await res.json()) as T;
    } catch (e) {
      if (timedOut) throw new ApiError(408, "request_timeout", "Tiempo de espera agotado.");
      throw e;
    }
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

export const api = {
  generateImage: (prompt: string, size: ImageSize = "1024x1024", n = 1, signal?: AbortSignal) =>
    apiJson<{ created: number; data: { url: string; revised_prompt?: string }[] }>("/v1/images/generations", { prompt, size, n }, "POST", signal, 60_000),
  status: () => apiJson<StatusResponse>("/health"),
  session: () => apiJson<SessionProfile>("/api/auth/me"),
  fsList: async (path: string): Promise<FsListResponse> => {
    const r = await apiJson<{ ok: boolean; entries: { name: string; is_dir: boolean; size?: number; modified?: number | string; mtime?: number | string }[] }>(`/api/workspace/list?path=${encodeURIComponent(path)}`);
    const items = (r.entries ?? []).map((entry) => ({
      name: entry.name,
      is_dir: entry.is_dir,
      size: entry.size ?? 0,
      modified: normalizeTs(entry.modified ?? entry.mtime, 0),
    }));
    return { ok: r.ok, path, items, total: items.length, showing: items.length };
  },
  fsRead: async (path: string): Promise<FsReadResponse> => {
    try {
      return await apiJson<FsReadResponse>("/api/fs/read", { path });
    } catch (error) {
      // v5.4 may reject regular files on /api/fs/read with 400 or 404; its authenticated download route remains usable.
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 400)) throw error;
      const res = await apiFetch(`/api/fs/download?path=${encodeURIComponent(path)}`, { method: "GET" });
      if (!res.ok) throw await parseError(res);
      const content = await res.text();
      const totalLines = content ? content.split("\n").length : 0;
      return { ok: true, name: path.split("/").pop() ?? path, content, total_lines: totalLines, truncated: false };
    }
  },
  fsWrite: async (path: string, content: string, append = false, encoding: "utf8" | "base64" = "utf8"): Promise<FsWriteResponse> => {
    if (append) throw new ApiError(501, "append_unavailable", "Añadir a un archivo no está disponible en este momento.");
    const r = await apiJson<{ ok: boolean; path: string; bytes_written: number }>("/api/fs/write", { path, content, encoding });
    return { ok: r.ok, name: r.path, mode: "write", bytes_written: r.bytes_written };
  },
  exec: (_req: ExecRequest): Promise<ExecResponse> => Promise.reject(new ApiError(501, "exec_unavailable", "La ejecución de código no está disponible.")),
  chats: async (): Promise<ChatListResponse> => {
    const r = await apiJson<{ ok: boolean; chats: ChatMeta[] }>("/api/workspace/chats");
    return { ok: r.ok, workspace_name: "Mi espacio", chats: (r.chats ?? []).map((chat) => {
      const normalized: ChatMeta = { ...chat };
      const created = normalizeTs(chat.created_at ?? chat.created, 0);
      const updated = normalizeTs(chat.updated_at ?? chat.updated, created);
      if (created > 0) normalized.created = created;
      if (updated > 0) normalized.updated = updated;
      return normalized;
    }) };
  },
  deleteChat: (id: string) => apiJson<{ ok: boolean; id: string; deleted: boolean }>(`/api/workspace/chat?id=${encodeURIComponent(id)}`, undefined, "DELETE"),
  getChat: async (id: string): Promise<{ ok: boolean; chat_data: ChatData }> => {
    const r = await apiJson<{ ok: boolean; chat: ChatData & { created_at?: number | string; updated_at?: number | string } }>(`/api/workspace/chat?id=${encodeURIComponent(id)}`);
    const chat = r.chat;
    const now = Date.now();
    const created = normalizeTs(chat.created ?? chat.created_at, now);
    const updated = normalizeTs(chat.updated ?? chat.updated_at, created);
    return { ok: r.ok, chat_data: { ...chat, created, updated, messages: chat.messages ?? [] } };
  },
  files: async (): Promise<FilesResponse> => {
    const files: FilesResponse["files"] = [];
    let truncated = false;
    const walk = async (dir: string, depth: number) => {
      if (depth > 8 || files.length >= 500) {
        if (files.length >= 500) truncated = true;
        return;
      }
      let listing: FsListResponse;
      try { listing = await api.fsList(dir); } catch (error) { if (dir) return; throw error; }
      for (const item of listing.items) {
        const relPath = [dir, item.name].filter(Boolean).join("/");
        if (item.is_dir) { if (relPath !== "chats") await walk(relPath, depth + 1); }
        else files.push({ name: item.name, rel_path: relPath, size: item.size, modified: normalizeTs(item.modified, 0) });
        if (files.length >= 500) {
          truncated = true;
          break;
        }
      }
    };
    await walk("", 0);
    return { ok: true, workspace_name: "Mi espacio", files, ...(truncated ? { truncated: true } : {}) };
  },
  download: async (path: string): Promise<Blob> => {
    let res: Response;
    try {
      res = await apiFetch(`/api/fs/download?path=${encodeURIComponent(path)}`, { method: "GET" });
    } catch {
      throw new ApiError(0, "network", "No se pudo conectar con Erasmus.");
    }
    if (!res.ok) throw await parseError(res);
    return res.blob();
  },
  zip: async (): Promise<{ name: string; blob: Blob }> => {
    const res = await apiFetch("/api/workspace/zip", { method: "GET" });
    if (!res.ok) throw await parseError(res);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const name = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "workspace_erasmus.zip";
    return { name, blob: await res.blob() };
  },
  /** GET /v1/models; the server presents the Erasmus model brand. */
  models: () => apiJson<{ data: { id: string; context_length?: number }[] }>("/v1/models"),
  account: () => apiJson<AccountResponse>("/api/account/me"),
  redeemCoupon: (code: string) => apiJson<{ ok: boolean; message: string; type: string; value: number; expires_at?: string | null }>("/api/coupons/redeem", { code: code.trim().toUpperCase() }),
  syncChat: (chat: ChatData) => apiJson<{ ok: boolean; id: string }>("/api/workspace/sync_chat", { ...chat, created_at: chat.created, updated_at: chat.updated }),
};

/** Public health snapshot: deliberately bypasses apiFetch so no user credentials are attached. */
export async function publicStatus(): Promise<{ available: boolean }> {
  const response = await fetch(`${API_BASE}/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) return { available: false };
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  const state = String(data?.["status"] ?? data?.["state"] ?? "").toLowerCase();
  return {
    available:
      data?.["ok"] === true ||
      data?.["healthy"] === true ||
      state === "ok" ||
      state === "up" ||
      state === "ready" ||
      state === "healthy" ||
      state === "online",
  };
}

export interface StreamOptions {
  model: string;
  messages: { role: string; content: string | unknown[] }[];
  sessionId?: string;
  signal?: AbortSignal;
  onToken: (t: string) => void;
  /** delta.reasoning_content passthrough (PROPOSED). */
  onReasoning?: (t: string) => void;
  /** Final stream metadata: finish_reason ("length" = cut) and token usage. */
  onMeta?: (m: StreamMeta) => void;
  /** Overrides the saved reasoning level (compaction uses "low"). */
  reasoning?: string;
}
export interface StreamUsage { prompt: number; completion: number; reasoning: number; total: number }
export interface StreamMeta { finishReason?: string; usage?: StreamUsage }
function toUsage(u: Record<string, unknown> | null | undefined): StreamUsage | undefined {
  if (!u || typeof u["total_tokens"] !== "number") return undefined;
  const det = (u["completion_tokens_details"] ?? {}) as Record<string, unknown>;
  return { prompt: Number(u["prompt_tokens"] ?? 0), completion: Number(u["completion_tokens"] ?? 0), reasoning: Number(det["reasoning_tokens"] ?? 0), total: Number(u["total_tokens"]) };
}

function withSystem(msgs: StreamOptions["messages"]): StreamOptions["messages"] {
  const sys = [
    "Eres Erasmus. No tienes ejecución de Python o bash en este servidor. No emitas bloques code:python ni code:bash; muestra el código solicitado como bloques Markdown normales. Puedes trabajar con archivos mediante file:list, file:read y file:write. file:append no está disponible: para actualizar un archivo, lee su contenido y reescríbelo completo con file:write.",
    customSystemText(),
  ].filter(Boolean).join("\n\n");
  return sys ? [{ role: "system", content: sys }, ...msgs] : msgs;
}

function processSseLine(rawLine: string, opts: StreamOptions): boolean {
  const line = rawLine.trim();
  if (!line.startsWith("data:")) return false;
  const data = line.slice(5).trim();
  if (data === "[DONE]") return true;
  try {
    const j = JSON.parse(data);
    const t = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content;
    if (t) opts.onToken(t);
    const rc = j?.choices?.[0]?.delta?.reasoning_content ?? j?.choices?.[0]?.delta?.reasoning ?? j?.choices?.[0]?.delta?.thinking ?? j?.choices?.[0]?.delta?.thought;
    if (rc) opts.onReasoning?.(rc);
    const fr = j?.choices?.[0]?.finish_reason;
    const us = toUsage(j?.usage);
    if (fr || us) opts.onMeta?.({ ...(fr ? { finishReason: fr } : {}), ...(us ? { usage: us } : {}) });
    if (j?.error) throw new ApiError(502, j.error.code ?? "stream", j.error.message ?? "Error en el stream");
  } catch (e) {
    if (e instanceof ApiError) throw e;
  }
  return false;
}

/** POST /v1/chat/completions with stream:true; parses SSE "data:" lines token by token. */
export async function streamChat(opts: StreamOptions): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch("/v1/chat/completions", {
      method: "POST",
      signal: opts.signal ?? null,
      headers: opts.sessionId ? { "X-Session-ID": opts.sessionId } : {},
      body: JSON.stringify({ model: getModelConfig().model || opts.model, messages: withSystem(opts.messages), stream: true, reasoning_effort: opts.reasoning ?? getModelConfig().reasoning }),
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw new ApiError(0, "network", "No se pudo conectar con Erasmus.");
  }
  if (!res.ok) throw await parseError(res);
  const ctype = res.headers.get("Content-Type") ?? "";
  if (!res.body || !ctype.includes("event-stream")) {
    const j = await res.json().catch(() => null);
    const c = j?.choices?.[0]?.message?.content;
    if (c) opts.onToken(c);
    const rc0 = j?.choices?.[0]?.message?.reasoning_content ?? j?.choices?.[0]?.message?.reasoning ?? j?.choices?.[0]?.message?.thinking ?? j?.choices?.[0]?.message?.thought;
    if (rc0) opts.onReasoning?.(rc0);
    const u0 = toUsage(j?.usage);
    opts.onMeta?.({ ...(j?.choices?.[0]?.finish_reason ? { finishReason: j.choices[0].finish_reason } : {}), ...(u0 ? { usage: u0 } : {}) });
    return;
  }
  const reader = res.body.getReader();
  let finished = false;
  const sseOpts: typeof opts = { ...opts, onMeta: (m) => { if (m.finishReason) finished = true; opts.onMeta?.(m); } };
  const dec = new TextDecoder();
  let buf = "";
  const INACTIVITY_TIMEOUT_MS = 35000;
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      timedOut = true;
      try { void reader.cancel(); } catch { /* ignore */ }
    }, INACTIVITY_TIMEOUT_MS);
  };
  try {
    resetInactivity();
    for (;;) {
      const { value, done } = await reader.read();
      resetInactivity();
      if (done) {
        buf += dec.decode();
        if (buf.trim()) {
          for (const tail of buf.split("\n")) {
            if (processSseLine(tail, sseOpts)) return;
          }
        }
        break;
      }
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (processSseLine(line, opts)) return;
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    if (timedOut) throw new ApiError(408, "stream_timeout", "La conexión con Erasmus se interrumpió por inactividad. Puedes reintentar.");
    throw e;
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    // Close the stream even after [DONE] or a parser error so the connection is released.
    try { await reader.cancel(); } catch { /* already closed */ }
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  if (timedOut) throw new ApiError(408, "stream_timeout", "La conexión con Erasmus se interrumpió por inactividad. Puedes reintentar.");
  // Clean EOF without [DONE] or a finish_reason means the answer was cut off.
  if (!finished) throw new ApiError(408, "stream_incomplete", "La respuesta se interrumpió antes de terminar. Puedes reintentar.");
}

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

/** Server says the session is no longer valid → wipe it locally and go to the login page. */
function onSessionRejected() {
  clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/entrar") window.location.assign("/entrar");
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
  if (res.status === 402) message = code === "weekly_allowance_reached" ? "Cupo de imágenes agotado para esta clave." : "Sin crédito suficiente. Contacta con el administrador para recargar.";
  if (res.status === 429) message = "Ya hay 4 respuestas en curso con esta clave. Espera a que termine alguna.";
  if (res.status === 502) message = "El modelo no respondió. Inténtalo de nuevo en unos segundos.";
  if (res.status === 503) {
    // Mantenimiento temporal del motor: si el servidor explica (p. ej. "Ajuste rápido"), se muestra tal cual; si no, mensaje claro sin expulsar la sesión.
    message = message.trim() && message !== `Error ${res.status}`
      ? message.trim()
      : "El motor de inferencia está en ajuste temporal. Vuelve a intentarlo en unos minutos.";
  }
  return new ApiError(res.status, code, message);
}

export async function apiJson<T>(path: string, body?: unknown, method?: "GET" | "POST" | "DELETE"): Promise<T> {
  let res: Response;
  try {
    const init: RequestInit = { method: method ?? (body === undefined ? "GET" : "POST") };
    if (body !== undefined) init.body = JSON.stringify(body);
    res = await apiFetch(path, init);
  } catch {
    throw new ApiError(0, "network", "No se pudo conectar con Erasmus.");
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const api = {
  status: () => apiJson<StatusResponse>("/health"),
  session: () => apiJson<SessionProfile>("/api/auth/me"),
  fsList: async (path: string): Promise<FsListResponse> => {
    const r = await apiJson<{ ok: boolean; entries: { name: string; is_dir: boolean; size?: number }[] }>(`/api/workspace/list?path=${encodeURIComponent(path)}`);
    const items = (r.entries ?? []).map((entry) => ({ ...entry, size: entry.size ?? 0, modified: 0 }));
    return { ok: r.ok, path, items, total: items.length, showing: items.length };
  },
  fsRead: async (path: string): Promise<FsReadResponse> => {
    try {
      return await apiJson<FsReadResponse>("/api/fs/read", { path });
    } catch (error) {
      // v5.4 may reject regular files on /api/fs/read; its authenticated download route remains usable.
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      const res = await apiFetch(`/api/fs/download?path=${encodeURIComponent(path)}`, { method: "GET" });
      if (!res.ok) throw await parseError(res);
      const content = await res.text();
      const totalLines = content ? content.split("\n").length : 0;
      return { ok: true, name: path.split("/").pop() ?? path, content, total_lines: totalLines, truncated: false };
    }
  },
  fsWrite: async (path: string, content: string, append = false): Promise<FsWriteResponse> => {
    if (append) throw new ApiError(501, "append_unavailable", "Añadir a un archivo no está disponible en el servidor v5.4.");
    const r = await apiJson<{ ok: boolean; path: string; bytes_written: number }>("/api/fs/write", { path, content });
    return { ok: r.ok, name: r.path, mode: "write", bytes_written: r.bytes_written };
  },
  exec: (_req: ExecRequest): Promise<ExecResponse> => Promise.reject(new ApiError(501, "exec_unavailable", "La ejecución de código no está disponible en el servidor v5.4.")),
  chats: async (): Promise<ChatListResponse> => {
    const r = await apiJson<{ ok: boolean; chats: ChatMeta[] }>("/api/workspace/chats");
    return { ok: r.ok, workspace_name: "Mi espacio", chats: (r.chats ?? []).map((chat) => {
      const normalized: ChatMeta = { ...chat };
      const created = chat.created_at ?? chat.created;
      const updated = chat.updated_at ?? chat.updated;
      if (created !== undefined) normalized.created = created;
      if (updated !== undefined) normalized.updated = updated;
      return normalized;
    }) };
  },
  deleteChat: (id: string) => apiJson<{ ok: boolean; id: string; deleted: boolean }>(`/api/workspace/chat?id=${encodeURIComponent(id)}`, undefined, "DELETE"),
  getChat: async (id: string): Promise<{ ok: boolean; chat_data: ChatData }> => {
    const r = await apiJson<{ ok: boolean; chat: ChatData & { created_at?: number; updated_at?: number } }>(`/api/workspace/chat?id=${encodeURIComponent(id)}`);
    const chat = r.chat;
    return { ok: r.ok, chat_data: { ...chat, created: chat.created ?? chat.created_at ?? Date.now(), updated: chat.updated ?? chat.updated_at ?? Date.now(), messages: chat.messages ?? [] } };
  },
  files: async (): Promise<FilesResponse> => {
    const files: FilesResponse["files"] = [];
    const walk = async (dir: string, depth: number) => {
      if (depth > 8 || files.length >= 500) return;
      let listing: FsListResponse;
      try { listing = await api.fsList(dir); } catch (error) { if (dir) return; throw error; }
      for (const item of listing.items) {
        const relPath = [dir, item.name].filter(Boolean).join("/");
        if (item.is_dir) { if (relPath !== "chats") await walk(relPath, depth + 1); }
        else files.push({ name: item.name, rel_path: relPath, size: item.size, modified: item.modified });
        if (files.length >= 500) break;
      }
    };
    await walk("", 0);
    return { ok: true, workspace_name: "Mi espacio", files };
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
  return { available: data?.["ok"] === true || state === "up" || state === "ready" };
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
    const rc0 = j?.choices?.[0]?.message?.reasoning_content;
    if (rc0) opts.onReasoning?.(rc0);
    const u0 = toUsage(j?.usage);
    opts.onMeta?.({ ...(j?.choices?.[0]?.finish_reason ? { finishReason: j.choices[0].finish_reason } : {}), ...(u0 ? { usage: u0 } : {}) });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const j = JSON.parse(data);
          const t = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content;
          if (t) opts.onToken(t);
          const rc = j?.choices?.[0]?.delta?.reasoning_content;
          if (rc) opts.onReasoning?.(rc);
          const fr = j?.choices?.[0]?.finish_reason;
          const us = toUsage(j?.usage);
          if (fr || us) opts.onMeta?.({ ...(fr ? { finishReason: fr } : {}), ...(us ? { usage: us } : {}) });
          if (j?.error) throw new ApiError(502, j.error.code ?? "stream", j.error.message ?? "Error en el stream");
        } catch (e) {
          if (e instanceof ApiError) throw e;
        }
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw e;
  }
}

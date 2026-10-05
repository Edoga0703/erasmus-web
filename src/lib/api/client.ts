import { API_BASE, MOCK, getToken } from "./config";
import type {
  ChatData,
  ChatListResponse,
  FsListResponse,
  FsReadResponse,
  FsWriteResponse,
  ExecRequest,
  ExecResponse,
  StatusResponse,
  FilesResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** All network I/O goes through here. In mock mode the request is served by /src/mocks. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("X-Erasmus-Token", token);
  const req = { ...init, headers };
  if (MOCK) {
    const { mockFetch } = await import("@/mocks");
    return mockFetch(path, req);
  }
  return fetch(`${API_BASE}${path}`, req);
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
  if (res.status === 403) message = "Acceso denegado: falta el token o el origen no está autorizado.";
  if (res.status === 401 && code === `http_401`) message = "Falta la clave de API de la VPS.";
  return new ApiError(res.status, code, message);
}

export async function apiJson<T>(path: string, body?: unknown, method?: "GET" | "POST"): Promise<T> {
  let res: Response;
  try {
    const init: RequestInit = { method: method ?? (body === undefined ? "GET" : "POST") };
    if (body !== undefined) init.body = JSON.stringify(body);
    res = await apiFetch(path, init);
  } catch {
    throw new ApiError(0, "network", "No se pudo conectar con el gateway.");
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const api = {
  status: () => apiJson<StatusResponse>("/api/status"),
  fsList: (path: string) => apiJson<FsListResponse>("/api/fs/list", { path }),
  fsRead: (path: string) => apiJson<FsReadResponse>("/api/fs/read", { path }),
  fsWrite: (path: string, content: string, append = false) =>
    apiJson<FsWriteResponse>("/api/fs/write", { path, content, append }),
  exec: (req: ExecRequest) => apiJson<ExecResponse>("/api/exec", req),
  chats: () => apiJson<ChatListResponse>("/api/workspace/chats"),
  getChat: (id: string) =>
    apiJson<{ ok: boolean; chat_data: ChatData }>(`/api/workspace/chat?id=${encodeURIComponent(id)}`),
  files: () => apiJson<FilesResponse>("/api/workspace/files"),
  /** GET /api/fs/download?path=&t= (token in query as in the reference; header still added by apiFetch). */
  download: async (path: string): Promise<Blob> => {
    let res: Response;
    try {
      res = await apiFetch(`/api/fs/download?path=${encodeURIComponent(path)}&t=${encodeURIComponent(getToken() ?? "")}`, { method: "GET" });
    } catch {
      throw new ApiError(0, "network", "No se pudo conectar con el gateway.");
    }
    if (!res.ok) throw await parseError(res);
    return res.blob();
  },
  syncChat: (chat: ChatData) => apiJson<{ ok: boolean }>("/api/workspace/sync_chat", { id: chat.id, chat_data: chat }),
};

export interface StreamOptions {
  model: string;
  messages: { role: string; content: string }[];
  sessionId?: string;
  signal?: AbortSignal;
  onToken: (t: string) => void;
  /** delta.reasoning_content passthrough (PROPOSED). */
  onReasoning?: (t: string) => void;
}

/** POST /api/chat with stream:true; parses SSE "data:" lines token by token. */
export async function streamChat(opts: StreamOptions): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch("/api/chat", {
      method: "POST",
      signal: opts.signal ?? null,
      headers: opts.sessionId ? { "X-Session-ID": opts.sessionId } : {},
      body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true }),
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw new ApiError(0, "network", "No se pudo conectar con el gateway.");
  }
  if (!res.ok) throw await parseError(res);
  const ctype = res.headers.get("Content-Type") ?? "";
  if (!res.body || !ctype.includes("event-stream")) {
    const j = await res.json().catch(() => null);
    const c = j?.choices?.[0]?.message?.content;
    if (c) opts.onToken(c);
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

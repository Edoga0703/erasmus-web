import { API_BASE, DIRECT, MOCK, MODEL_BASE, getModelConfig, getToken, isValidVpsKey } from "./config";

/** Routes the bridge proxies to the VPS: only these carry the ms- key (local fs/exec routes use the token only). */
const REMOTE = /^\/(v1\/|api\/chat|api\/models|api\/account\/|api\/images\/)/;
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
  if (DIRECT) return directFetch(path, init);
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("X-Erasmus-Token", token);
  if (REMOTE.test(path)) {
    const cfg = getModelConfig();
    if (isValidVpsKey(cfg.apiKey) && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${cfg.apiKey}`);
    if (cfg.compact && path.includes("chat")) headers.set("X-Compact-Mode", "1");
  }
  const req = { ...init, headers };
  if (MOCK) {
    const { mockFetch } = await import("@/mocks");
    return mockFetch(path, req);
  }
  return fetch(`${API_BASE}${path}`, req);
}

/** Routes the model server answers itself while the bridge is not deployed. */
const DIRECT_ROUTES = /^\/(v1\/|api\/account\/|api\/images\/|api\/status$)/;
export const BRIDGE_MISSING_MSG = "El sandbox, los archivos y el historial se activarán cuando el puente esté instalado en el servidor.";

/** Direct mode: /api/chat → /v1/chat/completions on the model server; only CORS-allowed headers; bridge routes answer 503 locally. */
async function directFetch(path: string, init: RequestInit): Promise<Response> {
  const target = path === "/api/chat" ? "/v1/chat/completions" : path;
  if (!DIRECT_ROUTES.test(target)) {
    return new Response(JSON.stringify({ error: { code: "bridge_unavailable", message: BRIDGE_MISSING_MSG } }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
  const src = new Headers(init.headers);
  const headers = new Headers();
  if (init.body) headers.set("Content-Type", "application/json");
  const cfg = getModelConfig();
  if (isValidVpsKey(cfg.apiKey)) headers.set("Authorization", `Bearer ${cfg.apiKey}`);
  const sid = src.get("X-Session-ID");
  if (sid) headers.set("X-Session-ID", sid);
  if (cfg.compact && target.includes("chat")) headers.set("X-Compact-Mode", "1");
  return fetch(`${MODEL_BASE}${target}`, { ...init, headers });
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
  if (res.status === 401 && code === "bridge_session_expired") message = "La sesión caducó: vuelve a abrir la página desde su enlace.";
  else if (res.status === 401 && (code === "unauthorized" || code === "http_401")) message = "Falta o no es válida la clave de API (ms-…). Configúrala en Ajustes → Modelo y API.";
  if (res.status === 401 && code === "not_a_key") message = "Clave de API inválida o inactiva.";
  if (res.status === 402) message = code === "weekly_allowance_reached" ? "Cupo de imágenes agotado para esta clave." : "Sin crédito suficiente. Contacta con el administrador para recargar.";
  if (res.status === 429) message = "Ya hay 4 respuestas en curso con esta clave. Espera a que termine alguna.";
  if (res.status === 502) message = "El modelo no respondió. Inténtalo de nuevo en unos segundos.";
  return new ApiError(res.status, code, message);
}

export async function apiJson<T>(path: string, body?: unknown, method?: "GET" | "POST"): Promise<T> {
  let res: Response;
  try {
    const init: RequestInit = { method: method ?? (body === undefined ? "GET" : "POST") };
    if (body !== undefined) init.body = JSON.stringify(body);
    res = await apiFetch(path, init);
  } catch {
    throw new ApiError(0, "network", "No se pudo conectar con el puente.");
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const api = {
  status: async (): Promise<StatusResponse> => {
    if (!DIRECT) return apiJson<StatusResponse>("/api/status");
    const r = await apiJson<{ state?: string }>("/api/status");
    if (r.state !== "up") throw new ApiError(503, "model_down", "El servidor del modelo no está disponible ahora mismo.");
    return { ok: true, app: "Erasmus", status: r.state, gateway_active: true, brand_model: getModelConfig().model || "erasmus-v1", workspace_name: "Sin sandbox", cwd: "" };
  },
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
      throw new ApiError(0, "network", "No se pudo conectar con el puente.");
    }
    if (!res.ok) throw await parseError(res);
    return res.blob();
  },
  /** POST /api/workspace/zip → {ok, zip_name, size}; the ZIP is then fetched with api.download(zip_name). */
  zip: () => apiJson<{ ok: boolean; zip_name: string; size: number }>("/api/workspace/zip", {}),
  /** GET /v1/models (bridge proxy; presents erasmus-v1). */
  models: () => apiJson<{ data: { id: string; context_length?: number }[] }>("/v1/models"),
  /** GET /api/account/me (VPS proxy; compatibility unverified per API_Erasmus.md). */
  account: () => apiJson<Record<string, unknown>>("/api/account/me"),
  syncChat: (chat: ChatData) => apiJson<{ ok: boolean }>("/api/workspace/sync_chat", { id: chat.id, chat_data: chat }),
};

export interface StreamOptions {
  model: string;
  messages: { role: string; content: string | unknown[] }[];
  sessionId?: string;
  signal?: AbortSignal;
  onToken: (t: string) => void;
  /** delta.reasoning_content passthrough (PROPOSED). */
  onReasoning?: (t: string) => void;
}

/** Direct mode has no bridge to add tool instructions, and no sandbox: tell the model to answer in plain Markdown. */
const DIRECT_SYSTEM = "Eres Erasmus, un asistente de IA para empresarios. Tu nombre es Erasmus; si te preguntan qué modelo eres, responde simplemente que eres Erasmus, sin hablar de proveedores ni nombres técnicos. Responde en el idioma del usuario, con Markdown claro. Ahora mismo no tienes sandbox ni herramientas: no emitas bloques code:python, code:bash ni file:*; si hace falta código, muéstralo como bloque normal (```python) para que el usuario lo vea.";

/** POST /api/chat with stream:true; parses SSE "data:" lines token by token. */
export async function streamChat(opts: StreamOptions): Promise<void> {
  let res: Response;
  try {
    res = await apiFetch("/api/chat", {
      method: "POST",
      signal: opts.signal ?? null,
      headers: opts.sessionId ? { "X-Session-ID": opts.sessionId } : {},
      body: JSON.stringify({ model: getModelConfig().model || opts.model, messages: DIRECT ? [{ role: "system", content: DIRECT_SYSTEM }, ...opts.messages] : opts.messages, stream: true, reasoning_effort: getModelConfig().reasoning }),
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    throw new ApiError(0, "network", "No se pudo conectar con el puente.");
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

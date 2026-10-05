/**
 * Mock gateway: simulates every endpoint in ANALYSIS.md §3 (incl. SSE).
 * Only loaded when VITE_MOCK=1. Scenario can be forced with
 * localStorage["erasmus.mock.scenario"] = ok | no_token | no_vps_key | vps_error | offline.
 */
import type { ChatData } from "@/lib/api/types";
import { scriptedReply, seedChats, seedFiles } from "./fixtures";
import { runBash, runPython } from "./sandbox";

interface MockBody { [k: string]: unknown; path?: unknown; content?: unknown; append?: unknown; messages?: unknown; filename?: unknown; subfolder?: unknown; content_base64?: unknown; data?: unknown; id?: unknown; conv_id?: unknown; chat_data?: unknown; name?: unknown }
type Store = { files: Record<string, string>; chats: Record<string, ChatData> };
let store: Store | null = null;
const db = (): Store => (store ??= { files: seedFiles(), chats: seedChats() });

function scenario(): string {
  try {
    return localStorage.getItem("erasmus.mock.scenario") ?? "ok";
  } catch {
    return "ok";
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\/?/, "").replace(/^\/+|\/+$/g, "");

function sse(text: string, signal?: AbortSignal | null): Response {
  const enc = new TextEncoder();
  const tokens = text.match(/\s*\S+|\s+/g) ?? [];
  let i = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const stop = () => {
        if (timer) clearInterval(timer);
        try { ctrl.close(); } catch { /* closed */ }
      };
      signal?.addEventListener("abort", stop);
      timer = setInterval(() => {
        if (i >= tokens.length) {
          ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
          stop();
          return;
        }
        const chunk = { id: "mock", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: tokens[i++] } }] };
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }, 28);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
}

function listDir(path: string) {
  const base = norm(path);
  const prefix = base ? base + "/" : "";
  const entries = new Map<string, { is_dir: boolean; size: number }>();
  for (const [p, c] of Object.entries(db().files)) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    const [head = "", ...tail] = rest.split("/");
    if (tail.length) entries.set(head, { is_dir: true, size: 0 });
    else entries.set(head, { is_dir: false, size: c.length });
  }
  if (base && entries.size === 0) return null;
  return [...entries.entries()]
    .sort((a, b) => Number(a[1].is_dir === false) - Number(b[1].is_dir === false) || a[0].localeCompare(b[0]))
    .map(([name, v]) => ({ name, ...v, modified: Math.floor(Date.now() / 1000) }));
}

export async function mockFetch(path: string, init: RequestInit & { headers: Headers }): Promise<Response> {
  const sc = scenario();
  await delay(120);
  if (sc === "offline") throw new TypeError("Failed to fetch (mock offline)");
  if (sc === "no_token" || !init.headers.get("X-Erasmus-Token")) return json(403, { ok: false, error: "origin_denied" });

  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://mock");
  const p = url.pathname;
  let body: MockBody = {};
  if (typeof init.body === "string") {
    try { body = JSON.parse(init.body); } catch { /* ignore */ }
  }
  const s = db();

  if (method === "GET") {
    if (p === "/api/status")
      return json(200, { ok: true, app: "Erasmus Platform Local Gateway", status: "ready", gateway_active: true, brand_model: "erasmus-v1", workspace_name: "default", cwd: "default" });
    if (p === "/api/models" || p === "/v1/models") {
      if (sc === "no_vps_key") return json(401, { error: { code: "unauthorized", message: "Clave de API ausente. Configúrala en config.json" } });
      return json(200, { object: "list", data: [{ id: "erasmus-v1", object: "model" }, { id: "erasmus-v1-fast", object: "model" }] });
    }
    if (p === "/api/account/me") return json(200, { ok: true, plan: "pro", balance: 42.5 });
    if (p === "/api/workspace/files")
      return json(200, { ok: true, workspace_name: "default", files: Object.entries(s.files).map(([rel, c]) => ({ name: rel.split("/").pop(), rel_path: rel, size: c.length, modified: Math.floor(Date.now() / 1000) })) });
    if (p === "/api/workspace/chats")
      return json(200, { ok: true, workspace_name: "default", chats: Object.values(s.chats).sort((a, b) => b.updated - a.updated).map((c) => ({ id: c.id, title: c.title, updated: c.updated, created: c.created, messages_count: c.messages.length })) });
    if (p === "/api/workspace/chat") {
      const c = s.chats[url.searchParams.get("id") ?? ""];
      return c ? json(200, { ok: true, chat_data: c }) : json(404, { ok: false, error: "Chat no encontrado en disco" });
    }
    if (p === "/api/fs/download" || p === "/api/workspace/download") {
      const f = s.files[norm(url.searchParams.get("path") ?? "")];
      return f === undefined ? json(404, { ok: false, error: "Archivo no encontrado" }) : new Response(f, { headers: { "Content-Type": "application/octet-stream" } });
    }
    return json(404, { error: "not_found" });
  }

  switch (p) {
    case "/api/chat":
    case "/v1/chat/completions": {
      if (sc === "no_vps_key") return json(401, { error: { code: "unauthorized", message: "Clave de API ausente. Configúrala en config.json" } });
      if (sc === "vps_error") return json(502, { error: { code: "gateway_vps_error", message: "Erasmus Gateway error: la VPS no responde" } });
      const msgs = (body.messages as { role: string; content: string }[]) ?? [];
      const last = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
      const followups = msgs.filter((m) => m.role === "user" && m.content.startsWith("[RESULTADOS")).length;
      const firstUser = msgs.find((m) => m.role === "user" && !m.content.startsWith("[RESULTADOS"))?.content ?? last;
      return sse(scriptedReply(firstUser, followups), init.signal);
    }
    case "/api/exec": {
      const language = String(body.language ?? "bash");
      const timeout = Math.min(Number(body.timeout ?? 60) || 60, 300);
      const cwd = norm(String(body.cwd ?? "."));
      const code = String(body.code ?? body.cmd ?? body.command ?? "");
      await delay(350);
      const r = language === "python" ? runPython(s.files, code, cwd, timeout) : runBash(s.files, code, cwd, timeout);
      return json(200, r);
    }
    case "/api/fs/list": {
      const items = listDir(String(body.path ?? "."));
      if (!items) return json(404, { ok: false, error: `Directorio no encontrado: ${body.path}` });
      return json(200, { ok: true, path: norm(String(body.path ?? ".")) || "default", items, total: items.length, showing: items.length });
    }
    case "/api/fs/read": {
      const key = norm(String(body.path ?? ""));
      const c = s.files[key];
      if (c === undefined) return json(404, { ok: false, error: `Archivo no encontrado: ${body.path}` });
      return json(200, { ok: true, name: key.split("/").pop(), total_lines: c.split("\n").length, content: c });
    }
    case "/api/fs/write": {
      const key = norm(String(body.path ?? ""));
      if (!key) return json(400, { ok: false, error: "Ruta ausente" });
      const content = String(body.content ?? "");
      s.files[key] = body.append ? (s.files[key] ?? "") + content : content;
      return json(200, { ok: true, name: key.split("/").pop(), mode: body.append ? "append" : "write", bytes_written: new TextEncoder().encode(content).length });
    }
    case "/api/workspace/upload": {
      const name = String(body.filename ?? "").split("/").pop() ?? "";
      const sub = String(body.subfolder ?? "uploads");
      let text = "";
      try { text = atob(String(body.content_base64 ?? body.data ?? "")); } catch { /* binary */ }
      const rel = `${sub}/${name}`;
      s.files[rel] = text;
      return json(200, { ok: true, name, rel_path: rel, abs_path: `/mock/${rel}`, size: text.length });
    }
    case "/api/workspace/sync_chat": {
      const id = String(body.id ?? body.conv_id ?? "").replace(/[^\w-]/g, "");
      if (!id) return json(400, { ok: false, error: "ID de conversación requerido" });
      const cd = (body.chat_data ?? {}) as ChatData;
      s.chats[id] = { ...cd, id, updated: Date.now() };
      return json(200, { ok: true, id, json_path: `chats/${id}.json`, md_path: `chats/${id}.md`, size_json: JSON.stringify(cd).length, saved_at: Math.floor(Date.now() / 1000) });
    }
    case "/api/workspace/get_chat": {
      const c = s.chats[String(body.id ?? "")];
      return c ? json(200, { ok: true, chat_data: c }) : json(404, { ok: false, error: "Chat no encontrado en disco" });
    }
    case "/api/workspace/save_artifact": {
      const name = String(body.filename || `artifact_${Date.now()}.txt`);
      s.files[`artifacts/${name}`] = String(body.content ?? "");
      return json(200, { ok: true, name, rel_path: `artifacts/${name}`, abs_path: `/mock/artifacts/${name}`, size: String(body.content ?? "").length });
    }
    case "/api/workspace/set":
      return json(200, { ok: true, workspace_name: String(body.name || "default"), workspace_path: "/mock" });
    case "/api/workspace/zip":
      return json(200, { ok: true, zip_name: "workspace.zip", size: 1024 });
    case "/api/stop":
      return json(200, { ok: true, message: "Stopping server" });
    // PROPOSED endpoints are intentionally NOT mocked: the UI must degrade.
    default:
      return json(404, { error: "Unknown endpoint" });
  }
}

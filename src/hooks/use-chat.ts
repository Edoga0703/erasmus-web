import { userKey } from "@/lib/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, streamChat, type StreamUsage } from "@/lib/api/client";
import { extractBlocks, lineDiff, type DiffRow, type ToolBlock } from "@/lib/blocks";
import type { ChatData, StoredMessage } from "@/lib/api/types";
import type { CompactionState } from "@/components/chat/Compaction";
import { ANSWER_RESERVE, COMPACT_AT, COMPACT_PROMPT, FILE_MAX_FRACTION, FILE_TOO_BIG_MSG, KEEP_RECENT, LIMIT_MSG, estimateTokens, getContextLength, historyTokens, isContextOverflow } from "@/lib/context";

export type ToolStatus = "running" | "ok" | "error" | "limit" | "saved";
export interface ToolState { status: ToolStatus; detail?: string | undefined; output?: string; diff?: DiffRow[]; exitCode?: number; durationMs?: number; stdout?: string; stderr?: string }
export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
  streaming?: boolean;
  tools?: Record<number, ToolState>;
  reasoning?: string;
  /** Milliseconds spent reasoning (first → last reasoning token). */
  thinkMs?: number;
  /** finish_reason of the last stream; "length" means the answer was cut. */
  finish?: string;
  usage?: StreamUsage;
  error?: { message: string; retryable: boolean };
  attachments?: Attachment[];
  /** "compaction" = visible separator line; when done it carries the summary that replaces messages before cutId. */
  kind?: "compaction";
  compaction?: CompactionState;
  summary?: string;
  cutId?: string;
  ts: number;
}
/** File attached to a user message; `url` is a local object URL for image thumbnails (not persisted). */
export interface Attachment { name: string; size: number; url?: string | undefined; path?: string | undefined; text?: string | undefined; /** data: URL sent to the model as image input (not persisted). */ image?: string | undefined }

const MAX_AGENT_STEPS = 30;
const MAX_BLOCKS_PER_TURN = 30;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const EXEC_TIMEOUT_DEFAULT = 60;
export const EXEC_TIMEOUT_MAX = 300;
const OUTPUT_CAP = 64 * 1024;
const LOCAL_CHAT_KEY = () => userKey("active-chat.v1");
const cap = (t: string) => (t.length > OUTPUT_CAP ? t.slice(0, OUTPUT_CAP) + "\n…[salida truncada a 64 KB]" : t);

interface LocalChatSnapshot {
  v: 1;
  chatId: string;
  title: string;
  created: number;
  messages: UIMessage[];
}

function withoutTemporaryUrls(m: UIMessage): UIMessage {
  const clean: UIMessage = { ...m, streaming: false };
  if (m.compaction?.status === "running") clean.compaction = { ...m.compaction, status: "error" };
  if (m.attachments) clean.attachments = m.attachments.map(({ url: _url, image: _image, ...a }) => a);
  return clean;
}

function recoverLocalChat(): LocalChatSnapshot | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CHAT_KEY()) ?? "null") as Partial<LocalChatSnapshot> | null;
    if (parsed?.v !== 1 || typeof parsed.chatId !== "string" || typeof parsed.title !== "string" || !Array.isArray(parsed.messages)) return null;
    return {
      v: 1,
      chatId: parsed.chatId,
      title: parsed.title,
      created: typeof parsed.created === "number" ? parsed.created : Date.now(),
      messages: parsed.messages.map(withoutTemporaryUrls),
    };
  } catch {
    return null;
  }
}
/** Model-facing text of a user message: inline attachment text plus server workspace paths when available. */
type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
/** Images go as OpenAI-style image_url parts (the model accepts text + image input). */
function toModelContent(m: UIMessage): string | ContentPart[] {
  const text = withAttachments(m);
  const imgs = m.attachments?.filter((a) => a.image) ?? [];
  if (!imgs.length) return text;
  return [{ type: "text", text }, ...imgs.map((a) => ({ type: "image_url" as const, image_url: { url: a.image! } }))];
}
function withAttachments(m: UIMessage): string {
  const a = m.attachments;
  if (!a?.length) return m.content;
  const inline = a.filter((x) => x.text !== undefined).map((x) => `\n\n--- Archivo adjunto: ${x.name} ---\n${x.text}`).join("");
  const refs = a.filter((x) => x.text === undefined && !x.image).map((x) => x.path ?? x.name);
  return m.content + inline + (refs.length ? `\n\n[Archivos adjuntos: ${refs.join(", ")}]` : "");
}
/** What the model sees: latest finished summary (as system) + messages from its cut point; compaction lines never go to the model. */
function summaryBase(all: UIMessage[]): { summary?: string; start: number } {
  for (let i = all.length - 1; i >= 0; i--) {
    const m = all[i]!;
    if (m.kind === "compaction" && m.compaction?.status === "done" && m.summary) {
      const ci = all.findIndex((x) => x.id === m.cutId);
      return { summary: m.summary, start: ci >= 0 ? ci : i + 1 };
    }
  }
  return { start: 0 };
}
function modelHistory(all: UIMessage[], excludeId?: string) {
  const { summary, start } = summaryBase(all);
  const rest = all.slice(start).filter((m) => !m.kind && !m.error && m.id !== excludeId).map((m) => ({ role: m.role as string, content: toModelContent(m) }));
  return summary ? [{ role: "system", content: `[RESUMEN DE LA CONVERSACIÓN ANTERIOR]\n${summary}` }, ...rest] : rest;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const conversationDir = (convId: string) => `conversations/${convId}`;

async function runBlock(b: ToolBlock, convId: string): Promise<{ state: ToolState; feedback: string | null }> {
  try {
    if (b.kind === "code:python" || b.kind === "code:bash") {
      const language = b.kind === "code:python" ? "python" : "bash";
      const t0 = performance.now();
      const r = await api.exec({ language, code: b.body, cwd: conversationDir(convId), timeout: EXEC_TIMEOUT_DEFAULT });
      const ms = r.duration_ms ?? Math.round(performance.now() - t0);
      const stdout = cap(r.stdout ?? "");
      const stderr = cap(r.stderr ?? "");
      const secs = (ms / 1000).toFixed(1);
      const timedOut = r.exit_code === 124;
      const out = [stdout, stderr && `[stderr]\n${stderr}`].filter(Boolean).join("\n");
      return {
        state: { status: r.exit_code === 0 ? "ok" : "error", exitCode: r.exit_code, durationMs: ms, stdout, stderr, detail: timedOut ? `Tiempo agotado (${EXEC_TIMEOUT_DEFAULT} s)` : undefined },
        feedback: `[RESULTADO ${b.kind} (exit ${r.exit_code}, ${secs}s)]\n${out.slice(0, 8000) || "(sin salida)"}`,
      };
    }
    if (b.kind === "file:list") {
      const r = await api.fsList(b.target || ".");
      const lines = r.items.map((i) => `${i.is_dir ? "[DIR] " : ""}${i.name}${i.is_dir ? "" : ` (${i.size} B)`}`).join("\n");
      return { state: { status: "ok", detail: `${r.showing} de ${r.total} elementos`, output: lines || "(vacío)" }, feedback: `[CONTENIDO DEL DIRECTORIO ${b.target || "."}]:\n<datos>\n${lines}\n</datos>${r.warning ? `\n${r.warning}` : ""}` };
    }
    if (b.kind === "file:read") {
      const r = await api.fsRead(b.target);
      return { state: { status: "ok", detail: `${r.total_lines} líneas${r.truncated ? " (truncado)" : ""}`, output: r.content }, feedback: `[CONTENIDO DE ${b.target}]:\n<datos>\n${r.content.slice(0, 8000)}\n</datos>` };
    }
    // file:write / file:append
    const append = b.kind === "file:append";
    let before = "";
    try { before = (await api.fsRead(b.target)).content; } catch { before = ""; }
    const content = b.body.endsWith("\n") || !b.body ? b.body : b.body + "\n";
    const r = await api.fsWrite(b.target, content, append);
    const after = append ? before + content : content;
    const partial = !b.closed;
    return {
      state: { status: partial ? "error" : "ok", detail: `${r.bytes_written} bytes ${append ? "añadidos" : "escritos"}${partial ? " · bloque incompleto" : ""}`, diff: lineDiff(before, after) },
      feedback: partial
        ? `[AVISO DE BLOQUE INCOMPLETO]: El bloque para ${b.target} se cortó antes de cerrarse. Se guardó la porción recibida. Emite AHORA \`\`\`file:append ${b.target}\`\`\` para continuar.`
        : `[ARCHIVO GUARDADO EN ${b.target}]: ${r.bytes_written} bytes (${r.mode}).`,
    };
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : String(e);
    return { state: { status: "error", detail: msg }, feedback: `[ERROR EN ${b.kind} ${b.target}]: ${msg}` };
  }
}

export function useChat(opts: { model: string }) {
  const [chatId, setChatId] = useState<string>(() => uid());
  const [title, setTitle] = useState("Nueva conversación");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [localReady, setLocalReady] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef<UIMessage[]>([]);
  const created = useRef(Date.now());
  const titleRef = useRef(title);
  const temporaryRef = useRef(false);
  titleRef.current = title;

  useEffect(() => {
    const saved = recoverLocalChat();
    if (saved) {
      msgsRef.current = saved.messages;
      setMessages(saved.messages);
      setChatId(saved.chatId);
      setTitle(saved.title);
      titleRef.current = saved.title;
      created.current = saved.created;
    }
    setLocalReady(true);
  }, []);

  useEffect(() => {
    if (!localReady) return;
    if (temporary) return;
    const timer = window.setTimeout(() => {
      try {
        const snapshot: LocalChatSnapshot = {
          v: 1,
          chatId,
          title,
          created: created.current,
          messages: messages.map(withoutTemporaryUrls),
        };
        localStorage.setItem(LOCAL_CHAT_KEY(), JSON.stringify(snapshot));
      } catch {
        // Server persistence remains authoritative; local recovery is best effort.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [chatId, localReady, messages, temporary, title]);

  const commit = useCallback((fn: (m: UIMessage[]) => UIMessage[]) => {
    msgsRef.current = fn(msgsRef.current);
    setMessages(msgsRef.current);
  }, []);
  const patch = useCallback((id: string, p: Partial<UIMessage> | ((m: UIMessage) => Partial<UIMessage>)) => {
    commit((ms) => ms.map((m) => (m.id === id ? { ...m, ...(typeof p === "function" ? p(m) : p) } : m)));
  }, [commit]);

  const persist = useCallback(async (t: string) => {
    if (temporaryRef.current) return;
    const data: ChatData = {
      id: chatId,
      title: t,
      created: created.current,
      updated: Date.now(),
      messages: msgsRef.current.map<StoredMessage>((m) => (m.role === "user" ? { id: m.id, role: "user", text: m.content, ts: m.ts, hidden: m.hidden } : { id: m.id, role: "assistant", c: m.content, ts: m.ts, tools: m.tools, ...(m.kind ? { kind: m.kind, compaction: m.compaction?.status === "running" ? { ...m.compaction, status: "error" as const } : m.compaction, summary: m.summary, cutId: m.cutId } : {}), ...(m.reasoning ? { reasoning: m.reasoning, thinkMs: m.thinkMs } : {}), ...(m.usage ? { usage: m.usage } : {}), ...(m.finish ? { finish: m.finish } : {}) })),
    };
    try { await api.syncChat(data); setListVersion((v) => v + 1); } catch { /* best effort */ }
  }, [chatId]);

  /** Last failed model call; retry() relaunches exactly that call from the current history. */
  const [failure, setFailure] = useState<{ message: string; retryable: boolean; nonce: number } | null>(null);
  const [limit, setLimit] = useState<{ message: string; file: boolean } | null>(null);

  /** Summarize everything except the last KEEP_RECENT model-visible messages; shows a live line in the chat. */
  const compactNow = useCallback(async (signal: AbortSignal, ctxLen: number): Promise<boolean> => {
    const all = msgsRef.current.filter((m) => !m.streaming);
    const { summary: prev, start } = summaryBase(all);
    const rest = all.slice(start).filter((m) => !m.kind);
    if (rest.length <= KEEP_RECENT) {
      // Always visible: there is no older history to summarize, so the current message itself does not fit.
      const t = Date.now();
      commit((ms) => [...ms, { id: uid(), role: "assistant", kind: "compaction", content: "", compaction: { status: "error", startedAt: t, ms: 0, note: "Compactación intentada: no hay mensajes anteriores que resumir" }, ts: t }]);
      return false;
    }
    const older = rest.slice(0, rest.length - KEEP_RECENT);
    const cut = rest[rest.length - KEEP_RECENT]!;
    let transcript = (prev ? `Resumen previo:\n${prev}\n\n` : "") + older.map((m) => `${m.role === "user" ? "Usuario" : "Erasmus"}: ${withAttachments(m)}`).join("\n\n");
    const maxChars = Math.floor(ctxLen * 0.6) * 4;
    if (transcript.length > maxChars) transcript = "…" + transcript.slice(-maxChars);
    const cid = uid();
    const t0 = Date.now();
    commit((ms) => [...ms, { id: cid, role: "assistant", kind: "compaction", content: "", compaction: { status: "running", startedAt: t0 }, ts: t0 }]);
    let out = "";
    try {
      await streamChat({ model: opts.model, messages: [{ role: "user", content: `${COMPACT_PROMPT}\n\n<conversacion>\n${transcript}\n</conversacion>` }], sessionId: chatId, signal, reasoning: "low", onToken: (tk) => { out += tk; } });
    } catch (e) {
      patch(cid, { compaction: { status: "error", startedAt: t0, ms: Date.now() - t0 } });
      throw e;
    }
    if (signal.aborted || !out.trim()) {
      patch(cid, { compaction: { status: "error", startedAt: t0, ms: Date.now() - t0 } });
      return false;
    }
    patch(cid, { summary: out.trim(), cutId: cut.id, compaction: { status: "done", startedAt: t0, ms: Date.now() - t0 } });
    await sleep(1000);
    return true;
  }, [chatId, commit, opts.model, patch]);

  const runLoop = useCallback(async (t: string) => {
    setBusy(true);
    setFailure(null);
    setLimit(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let executed = 0;
    let activeAssistantId: string | null = null;
    try {
      for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const ctxLen = await getContextLength(opts.model);
        if (historyTokens(modelHistory(msgsRef.current)) > ctxLen * COMPACT_AT - ANSWER_RESERVE) {
          await compactNow(ctrl.signal, ctxLen);
          if (ctrl.signal.aborted) break;
        }
        let retried = false;
        let aid = "";
        let acc = "";
        for (;;) {
          aid = uid();
          const id = aid;
          activeAssistantId = id;
          commit((ms) => [...ms, { id, role: "assistant", content: "", streaming: true, tools: {}, ts: Date.now() }]);
          const history = modelHistory(msgsRef.current, id);
          acc = "";
          let reasoning = "";
          let frame: number | undefined;
          let r0 = 0, r1 = 0;
          let meta: { finish?: string; usage?: StreamUsage } = {};
          const schedulePaint = () => {
            if (frame !== undefined) return;
            frame = requestAnimationFrame(() => {
              frame = undefined;
              patch(id, { content: acc, ...(reasoning ? { reasoning } : {}) });
            });
          };
          try {
            await streamChat({
              model: opts.model,
              messages: history,
              sessionId: chatId,
              signal: ctrl.signal,
              onToken: (tok) => { acc += tok; schedulePaint(); },
              onReasoning: (tok) => { const n = Date.now(); if (!r0) r0 = n; r1 = n; reasoning += tok; schedulePaint(); },
              onMeta: (mm) => { meta = { ...meta, ...(mm.finishReason ? { finish: mm.finishReason } : {}), ...(mm.usage ? { usage: mm.usage } : {}) }; },
            });
          } catch (e) {
            if (!isContextOverflow(e)) throw e;
            commit((ms) => ms.filter((m) => m.id !== id));
            // One automatic compaction + retry; a second overflow (or nothing left to compact) is terminal.
            if (!retried) {
              retried = true;
              if (await compactNow(ctrl.signal, ctxLen)) { if (ctrl.signal.aborted) return; continue; }
            }
            throw new ApiError(413, "context_overflow_final", LIMIT_MSG);
          } finally {
            if (frame !== undefined) cancelAnimationFrame(frame);
          }
          patch(id, { content: acc, ...(reasoning ? { reasoning, thinkMs: Math.max(r1 - r0, 1) } : {}), ...meta, streaming: false });
          activeAssistantId = null;
          break;
        }
        if (ctrl.signal.aborted) break;

        const blocks = extractBlocks(acc);
        if (!blocks.length) break;
        const feedback: string[] = [];
        let limitHit = false;
        for (let i = 0; i < blocks.length; i++) {
          if (ctrl.signal.aborted) break;
          if (executed >= MAX_BLOCKS_PER_TURN) {
            limitHit = true;
            patch(aid, (m) => ({ tools: { ...m.tools, [i]: { status: "limit", detail: "Límite de pasos alcanzado (30 bloques por turno)." } } }));
            continue;
          }
          const blk = blocks[i]!;
          patch(aid, (m) => ({ tools: { ...m.tools, [i]: { status: "running" } } }));
          const { state, feedback: fb } = await runBlock(blk, chatId);
          executed++;
          patch(aid, (m) => ({ tools: { ...m.tools, [i]: state } }));
          if (fb) feedback.push(fb);
        }
        if (ctrl.signal.aborted) break;
        if (limitHit) { setError("Límite de pasos alcanzado: el agente se detuvo tras 30 bloques."); break; }
        if (step === MAX_AGENT_STEPS - 1) { setError("Pausa de control: límite de pasos del agente alcanzado."); break; }
        commit((ms) => [...ms, { id: uid(), role: "user", hidden: true, content: `[RESULTADOS DE HERRAMIENTAS]\n${feedback.join("\n\n")}`, ts: Date.now() }]);
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "context_overflow_final") {
        commit((ms) => ms.filter((m) => !m.streaming));
        const lastUser = [...msgsRef.current].reverse().find((m) => m.role === "user" && !m.hidden);
        const bigFile = !!lastUser?.attachments?.some((a) => a.text !== undefined || a.image);
        setLimit(bigFile ? { message: FILE_TOO_BIG_MSG, file: true } : { message: LIMIT_MSG, file: false });
        return;
      }
      const err = e instanceof ApiError ? e : null;
      const retryable = !err || err.status === 0 || err.status === 408 || err.status >= 500;
      const message = !err ? "Error inesperado en la conversación." : err.status === 0 ? "Sin conexión con Erasmus." : err.status === 504 || err.status === 408 ? "Tiempo de espera agotado." : err.message;
      if (activeAssistantId) patch(activeAssistantId, { streaming: false, error: { message, retryable } });
      setFailure({ message, retryable, nonce: Date.now() });
    } finally {
      setBusy(false);
      abortRef.current = null;
      window.dispatchEvent(new Event("erasmus:turn-done"));
      void persist(t);
    }
  }, [chatId, commit, compactNow, opts.model, patch, persist]);

  const send = useCallback(async (text: string, attachments?: Attachment[]) => {
    const clean = text.trim() || (attachments?.length ? "Revisa los archivos adjuntos." : "");
    if (!clean || busy) return;
    setError(null);
    // Límite de tamaño de adjuntos desactivado temporalmente para pruebas (ver FILE_MAX_FRACTION).
    let t = titleRef.current;
    if (msgsRef.current.length === 0) { t = clean.slice(0, 60); setTitle(t); titleRef.current = t; }
    commit((ms) => [...ms, { id: uid(), role: "user", content: clean, ts: Date.now(), ...(attachments?.length ? { attachments } : {}) }]);
    await runLoop(t);
  }, [busy, commit, opts.model, runLoop]);

  const retry = useCallback(() => {
    if (busy) return;
    commit((ms) => ms.filter((m) => !m.error));
    void runLoop(titleRef.current);
  }, [busy, commit, runLoop]);

  /** The last answer was cut (finish_reason "length"): ask the model to continue where it stopped. */
  const continueLast = useCallback(() => {
    if (busy) return;
    commit((ms) => [...ms, { id: uid(), role: "user", hidden: true, content: "Continúa exactamente donde te quedaste, sin repetir lo anterior.", ts: Date.now() }]);
    void runLoop(titleRef.current);
  }, [busy, commit, runLoop]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    msgsRef.current = [];
    setMessages([]);
    setChatId(uid());
    setTitle("Nueva conversación");
    titleRef.current = "Nueva conversación";
    setError(null);
    setFailure(null);
    setLimit(null);
    setTemporary(false);
    temporaryRef.current = false;
    created.current = Date.now();
  }, []);

  const startTemporary = useCallback(() => {
    abortRef.current?.abort();
    msgsRef.current = [];
    setMessages([]);
    setChatId(uid());
    setTitle("Conversación temporal");
    titleRef.current = "Conversación temporal";
    setError(null);
    setFailure(null);
    setLimit(null);
    setTemporary(true);
    temporaryRef.current = true;
    created.current = Date.now();
  }, []);

  const branchFrom = useCallback(async (messageId: string) => {
    const index = msgsRef.current.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    const branched = msgsRef.current.slice(0, index + 1).map(withoutTemporaryUrls);
    const nextId = uid();
    const nextTitle = `Rama de ${titleRef.current}`.slice(0, 120);
    const now = Date.now();
    msgsRef.current = branched;
    setMessages(branched);
    setChatId(nextId);
    setTitle(nextTitle);
    titleRef.current = nextTitle;
    created.current = now;
    setTemporary(false);
    temporaryRef.current = false;
    await api.syncChat({ id: nextId, title: nextTitle, created: now, updated: now, messages: branched.map<StoredMessage>((m) => m.role === "user" ? { id: m.id, role: "user", text: m.content, ts: m.ts, hidden: m.hidden } : { id: m.id, role: "assistant", c: m.content, ts: m.ts, tools: m.tools, reasoning: m.reasoning, thinkMs: m.thinkMs, finish: m.finish, usage: m.usage }) });
    setListVersion((version) => version + 1);
  }, []);

  /** Restore a saved chat; tool blocks re-render as cards from the persisted tools state. */
  const open = useCallback(async (id: string) => {
    abortRef.current?.abort();
    const { chat_data: cd } = await api.getChat(id);
    const src = cd.messages?.length ? cd.messages : cd.allMessages ?? [];
    const restored: UIMessage[] = src.map((sm) => {
      const content = (sm.role === "user" ? sm.text : sm.c) ?? sm.content ?? "";
      const base: UIMessage = { id: sm.id ?? uid(), role: sm.role, content, ts: sm.ts ?? cd.created };
      if (sm.kind === "compaction") {
        base.kind = "compaction";
        if (sm.compaction) base.compaction = sm.compaction.status === "running" ? { ...sm.compaction, status: "error" } : sm.compaction;
        if (sm.summary) base.summary = sm.summary;
        if (sm.cutId) base.cutId = sm.cutId;
        return base;
      }
      if (sm.hidden) base.hidden = true;
      if (sm.reasoning) { base.reasoning = sm.reasoning; if (sm.thinkMs) base.thinkMs = sm.thinkMs; }
      if (sm.usage) base.usage = sm.usage;
      if (sm.finish) base.finish = sm.finish;
      if (sm.role === "assistant") {
        const tools: Record<number, ToolState> = {};
        extractBlocks(content).forEach((_, i) => {
          const t = sm.tools?.[i];
          tools[i] = t ? ({ ...t, status: (["ok", "error", "limit"].includes(t.status) ? t.status : "saved") as ToolStatus } as ToolState) : { status: "saved" };
        });
        base.tools = tools;
      }
      return base;
    });
    msgsRef.current = restored;
    setMessages(restored);
    setChatId(cd.id || id);
    setTitle(cd.title || "Conversación");
    titleRef.current = cd.title || "Conversación";
    created.current = cd.created || Date.now();
    setError(null);
    setFailure(null);
    setLimit(null);
    setTemporary(false);
    temporaryRef.current = false;
  }, []);

  /** Rename = re-send chat_data with the new title through sync_chat (agreed contract). */
  const rename = useCallback(async (id: string, newTitle: string) => {
    const t = newTitle.trim().slice(0, 120);
    if (!t) return;
    if (id === chatId) {
      setTitle(t);
      titleRef.current = t;
      await persist(t);
      return;
    }
    const { chat_data: cd } = await api.getChat(id);
    await api.syncChat({ ...cd, id, title: t, updated: Date.now() });
    setListVersion((v) => v + 1);
  }, [chatId, persist]);

  return { open, rename, branchFrom, startTemporary, temporary, listVersion, chatId, title, messages, busy, error, send, stop, reset, continueLast, retry, failure, limit, dismissLimit: () => setLimit(null), dismissError: () => setError(null) };
}

import { useCallback, useRef, useState } from "react";
import { api, ApiError, streamChat } from "@/lib/api/client";
import { extractBlocks, lineDiff, type DiffRow, type ToolBlock } from "@/lib/blocks";
import type { ChatData, StoredMessage } from "@/lib/api/types";

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
  ts: number;
}

const MAX_AGENT_STEPS = 30;
const MAX_BLOCKS_PER_TURN = 30;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const EXEC_TIMEOUT_DEFAULT = 60;
export const EXEC_TIMEOUT_MAX = 300;
const OUTPUT_CAP = 64 * 1024;
const cap = (t: string) => (t.length > OUTPUT_CAP ? t.slice(0, OUTPUT_CAP) + "\n…[salida truncada a 64 KB]" : t);
export const sandboxDir = (convId: string) => `sandbox/${convId}`;

async function runBlock(b: ToolBlock, convId: string): Promise<{ state: ToolState; feedback: string | null }> {
  try {
    if (b.kind === "code:python" || b.kind === "code:bash") {
      const language = b.kind === "code:python" ? "python" : "bash";
      const t0 = performance.now();
      const r = await api.exec({ language, code: b.body, cwd: sandboxDir(convId), timeout: EXEC_TIMEOUT_DEFAULT });
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
  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef<UIMessage[]>([]);
  const created = useRef(Date.now());

  const commit = useCallback((fn: (m: UIMessage[]) => UIMessage[]) => {
    msgsRef.current = fn(msgsRef.current);
    setMessages(msgsRef.current);
  }, []);
  const patch = useCallback((id: string, p: Partial<UIMessage> | ((m: UIMessage) => Partial<UIMessage>)) => {
    commit((ms) => ms.map((m) => (m.id === id ? { ...m, ...(typeof p === "function" ? p(m) : p) } : m)));
  }, [commit]);

  const persist = useCallback(async (t: string) => {
    const data: ChatData = {
      id: chatId,
      title: t,
      created: created.current,
      updated: Date.now(),
      messages: msgsRef.current.map<StoredMessage>((m) => (m.role === "user" ? { role: "user", text: m.content, ts: m.ts, hidden: m.hidden } : { role: "assistant", c: m.content, ts: m.ts, tools: m.tools })),
    };
    try { await api.syncChat(data); setListVersion((v) => v + 1); } catch { /* best effort */ }
  }, [chatId]);

  /** Last failed model call; retry() relaunches exactly that call from the current history. */
  const [failure, setFailure] = useState<{ message: string; retryable: boolean; nonce: number } | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  const runLoop = useCallback(async (t: string) => {
    setBusy(true);
    setFailure(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let executed = 0;
    try {
      for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const aid = uid();
        commit((ms) => [...ms, { id: aid, role: "assistant", content: "", streaming: true, tools: {}, ts: Date.now() }]);
        const history = msgsRef.current.filter((m) => m.id !== aid).map((m) => ({ role: m.role, content: m.content }));
        let acc = "";
        let reasoning = "";
        await streamChat({
          model: opts.model,
          messages: history,
          sessionId: chatId,
          signal: ctrl.signal,
          onToken: (tok) => { acc += tok; patch(aid, { content: acc }); },
          onReasoning: (tok) => { reasoning += tok; patch(aid, { reasoning }); },
        });
        patch(aid, { streaming: false });
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
      // Drop the failed (streaming) assistant turn so a retry replays the very same request.
      commit((ms) => ms.filter((m) => !m.streaming));
      const err = e instanceof ApiError ? e : null;
      const retryable = !err || err.status === 0 || err.status === 408 || err.status >= 500;
      const message = !err ? "Error inesperado en la conversación." : err.status === 0 ? "Sin conexión con el puente." : err.status === 504 || err.status === 408 ? "Tiempo de espera agotado." : err.message;
      setFailure({ message, retryable, nonce: Date.now() });
    } finally {
      setBusy(false);
      abortRef.current = null;
      void persist(t);
    }
  }, [chatId, commit, opts.model, patch, persist]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    let t = titleRef.current;
    if (msgsRef.current.length === 0) { t = clean.slice(0, 60); setTitle(t); }
    commit((ms) => [...ms, { id: uid(), role: "user", content: clean, ts: Date.now() }]);
    await runLoop(t);
  }, [busy, commit, runLoop]);

  const retry = useCallback(() => {
    if (busy) return;
    void runLoop(titleRef.current);
  }, [busy, runLoop]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    msgsRef.current = [];
    setMessages([]);
    setChatId(uid());
    setTitle("Nueva conversación");
    setError(null);
    setFailure(null);
    created.current = Date.now();
  }, []);

  /** Restore a saved chat; tool blocks re-render as cards from the persisted tools state. */
  const open = useCallback(async (id: string) => {
    abortRef.current?.abort();
    const { chat_data: cd } = await api.getChat(id);
    const src = cd.messages?.length ? cd.messages : cd.allMessages ?? [];
    const restored: UIMessage[] = src.map((sm) => {
      const content = (sm.role === "user" ? sm.text : sm.c) ?? sm.content ?? "";
      const base: UIMessage = { id: uid(), role: sm.role, content, ts: sm.ts ?? cd.created };
      if (sm.hidden) base.hidden = true;
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
    created.current = cd.created || Date.now();
    setError(null);
    setFailure(null);
  }, []);

  /** Rename = re-send chat_data with the new title through sync_chat (agreed contract). */
  const rename = useCallback(async (id: string, newTitle: string) => {
    const t = newTitle.trim().slice(0, 120);
    if (!t) return;
    if (id === chatId) {
      setTitle(t);
      await persist(t);
      return;
    }
    const { chat_data: cd } = await api.getChat(id);
    await api.syncChat({ ...cd, id, title: t, updated: Date.now() });
    setListVersion((v) => v + 1);
  }, [chatId, persist]);

  return { open, rename, listVersion, chatId, title, messages, busy, error, send, stop, reset, retry, failure, dismissError: () => setError(null) };
}

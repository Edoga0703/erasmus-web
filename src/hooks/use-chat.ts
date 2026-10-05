import { useCallback, useRef, useState } from "react";
import { api, ApiError, streamChat } from "@/lib/api/client";
import { extractBlocks, lineDiff, type DiffRow, type ToolBlock } from "@/lib/blocks";
import type { ChatData, StoredMessage } from "@/lib/api/types";

export type ToolStatus = "running" | "ok" | "error" | "skipped";
export interface ToolState { status: ToolStatus; detail?: string; output?: string; diff?: DiffRow[] }
export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
  streaming?: boolean;
  tools?: Record<number, ToolState>;
  ts: number;
}

const MAX_AGENT_STEPS = 30;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

async function runBlock(b: ToolBlock): Promise<{ state: ToolState; feedback: string | null }> {
  try {
    if (b.kind === "powershell:run") {
      return { state: { status: "skipped", detail: "No ejecutado: la versión web no ejecuta PowerShell." }, feedback: "[POWERSHELL NO EJECUTADO]: el cliente web no ejecuta bloques powershell:run." };
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
      messages: msgsRef.current.map<StoredMessage>((m) => (m.role === "user" ? { role: "user", text: m.content, ts: m.ts, hidden: m.hidden } : { role: "assistant", c: m.content, ts: m.ts })),
    };
    try { await api.syncChat(data); } catch { /* best effort */ }
  }, [chatId]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let t = title;
    if (msgsRef.current.length === 0) {
      t = clean.slice(0, 60);
      setTitle(t);
    }
    commit((ms) => [...ms, { id: uid(), role: "user", content: clean, ts: Date.now() }]);

    try {
      for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const aid = uid();
        commit((ms) => [...ms, { id: aid, role: "assistant", content: "", streaming: true, tools: {}, ts: Date.now() }]);
        const history = msgsRef.current.filter((m) => m.id !== aid).map((m) => ({ role: m.role, content: m.content }));
        let acc = "";
        await streamChat({
          model: opts.model,
          messages: history,
          sessionId: chatId,
          signal: ctrl.signal,
          onToken: (tok) => { acc += tok; patch(aid, { content: acc }); },
        });
        patch(aid, { streaming: false });
        if (ctrl.signal.aborted) break;

        const blocks = extractBlocks(acc);
        if (!blocks.length) break;
        const feedback: string[] = [];
        let actionable = false;
        for (let i = 0; i < blocks.length; i++) {
          if (ctrl.signal.aborted) break;
          const blk = blocks[i]!;
          patch(aid, (m) => ({ tools: { ...m.tools, [i]: { status: "running" } } }));
          const { state, feedback: fb } = await runBlock(blk);
          if (blk.kind !== "powershell:run") actionable = true;
          patch(aid, (m) => ({ tools: { ...m.tools, [i]: state } }));
          if (fb) feedback.push(fb);
        }
        if (!actionable || ctrl.signal.aborted) break;
        if (step === MAX_AGENT_STEPS - 1) {
          setError("Pausa de control: límite de pasos del agente alcanzado.");
          break;
        }
        commit((ms) => [...ms, { id: uid(), role: "user", hidden: true, content: `[RESULTADOS DE HERRAMIENTAS]\n${feedback.join("\n\n")}`, ts: Date.now() }]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error inesperado en el chat.");
      commit((ms) => ms.map((m) => (m.streaming ? { ...m, streaming: false } : m)).filter((m) => !(m.role === "assistant" && !m.content)));
    } finally {
      setBusy(false);
      abortRef.current = null;
      void persist(t);
    }
  }, [busy, chatId, commit, opts.model, patch, persist, title]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    msgsRef.current = [];
    setMessages([]);
    setChatId(uid());
    setTitle("Nueva conversación");
    setError(null);
    created.current = Date.now();
  }, []);

  return { chatId, title, messages, busy, error, send, stop, reset, dismissError: () => setError(null) };
}

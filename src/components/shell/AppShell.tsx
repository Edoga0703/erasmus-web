import { useEffect, useRef, useState } from "react";
import { PanelLeft, Plus, RefreshCw, WifiOff, X } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useConnection } from "@/hooks/use-connection";
import { MOCK } from "@/lib/api/config";
import { MessageView } from "@/components/chat/MessageView";
import { Composer } from "@/components/chat/Composer";
import { cn } from "@/lib/utils";

export function AppShell() {
  const conn = useConnection();
  const model = conn.status?.brand_model ?? "erasmus-v1";
  const chat = useChat({ model });
  const [sideOpen, setSideOpen] = useState(false);
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  const visible = chat.messages.filter((m) => !m.hidden);
  const down = conn.state === "offline" || conn.state === "denied";

  return (
    <div className="flex h-dvh overflow-hidden bg-e-bg2 text-e-tx">
      {sideOpen && <div className="e-overlay fixed inset-0 z-30 md:hidden" onClick={() => setSideOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-side flex-col border-r border-e-line bg-e-bg transition-transform md:static md:translate-x-0",
          sideOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-top items-center gap-2 px-3">
          <div className="flex-1 leading-tight">
            <div className="text-[14px] font-semibold tracking-tight">Erasmus</div>
            <div className="text-[10px] text-e-dim">Web{MOCK ? " · modo demostración" : ""}</div>
          </div>
          <button className="e-icon-btn md:hidden" aria-label="Cerrar barra lateral" onClick={() => setSideOpen(false)}>
            <X className="size-3.5" />
          </button>
        </div>
        <div className="px-3">
          <button
            onClick={() => { chat.reset(); setSideOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg border border-e-line px-3 py-2 text-[13px] hover:bg-e-bg3"
          >
            <Plus className="size-3.5" /> Nueva conversación
          </button>
        </div>
        <nav className="mt-3 flex-1 overflow-y-auto px-2">
          <div className="truncate rounded-md bg-e-bg3 px-2.5 py-1.5 text-[13px]">{chat.title}</div>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-top shrink-0 items-center gap-2.5 border-b border-e-line bg-e-bg2 px-4 md:px-[18px]">
          <button className="e-icon-btn md:hidden" aria-label="Abrir barra lateral" onClick={() => setSideOpen(true)}>
            <PanelLeft className="size-3.5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[14px] font-medium">{chat.title}</h1>
          <span className="flex items-center gap-1.5 text-[11.5px] text-e-dim">
            <i className={cn("inline-block size-2 rounded-full", conn.state === "online" ? "bg-e-ok" : conn.state === "checking" ? "bg-e-dim" : "bg-e-err")} />
            {conn.state === "online" ? "Conectado" : conn.state === "checking" ? "Conectando…" : "Sin conexión"}
          </span>
          <span className="rounded-md border border-e-line px-2 py-0.5 font-mono text-[11px] text-e-dim">{model}</span>
        </header>

        {down && (
          <div className="e-err-banner mx-4 mt-3 flex items-center gap-3 px-3 py-2 text-[13px]" role="alert">
            <WifiOff className="size-4 shrink-0" />
            <span className="flex-1">{conn.state === "denied" ? conn.message : "Conexión caída: " + conn.message}</span>
            <button onClick={() => void conn.retry()} className="inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-[12px]">
              <RefreshCw className="size-3" /> Reintentar
            </button>
          </div>
        )}

        <section ref={scroller} className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <h2 className="text-[22px] font-semibold tracking-tight">¿En qué trabajamos hoy?</h2>
              <p className="mt-2 max-w-sm text-[13px] text-e-dim">Erasmus puede leer, listar y escribir archivos de tu workspace mientras conversa contigo.</p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
              {visible.map((m) => <MessageView key={m.id} m={m} />)}
            </div>
          )}
        </section>

        {chat.error && (
          <div className="e-err-banner mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-2 px-3 py-2 text-[13px]" role="alert">
            <span className="flex-1">{chat.error}</span>
            <button onClick={chat.dismissError} aria-label="Cerrar aviso"><X className="size-3.5" /></button>
          </div>
        )}
        <Composer busy={chat.busy} disabled={down} onSend={(t) => void chat.send(t)} onStop={chat.stop} />
      </main>
    </div>
  );
}

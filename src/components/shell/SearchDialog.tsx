import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, SquarePen, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { groupByDate, useChatManifest } from "./ChatList";
import { api, normalizeTs } from "@/lib/api/client";

type Match = { snippet: string; date: number };
const snippet = (text: string, query: string) => {
  const clean = text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  const at = clean.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return "";
  return `${at > 42 ? "…" : ""}${clean.slice(Math.max(0, at - 42), at + query.length + 72)}${at + query.length + 72 < clean.length ? "…" : ""}`;
};

/** ChatGPT-style centered search over conversation titles (manifest only; no full-text endpoint). */
export function SearchDialog({ open, onClose, onOpen, onNew, version }: { open: boolean; onClose: () => void; onOpen: (id: string) => void; onNew: () => void; version: number }) {
  const { chats, err } = useChatManifest(version + (open ? 1 : 0));
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; matches: Record<string, Match> }>({ term: "", matches: {} });
  const matches = result.term === q.trim() ? result.matches : {};
  const [searchingContent, setSearchingContent] = useState(false);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const l = (chats ?? []).filter((c) => !term || (c.title || "").toLowerCase().includes(term) || !!matches[c.id]);
    return groupByDate(l);
  }, [chats, matches, q]);

  useEffect(() => {
    const term = q.trim();
    setSearchingContent(false);
    if (!open || term.length < 3 || !chats?.length) { setResult({ term, matches: {} }); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingContent(true);
      const found: Record<string, Match> = {};
      for (const chat of chats.slice(0, 12)) {
        try {
          const { chat_data } = await api.getChat(chat.id);
          const source = (chat_data.messages?.length ? chat_data.messages : chat_data.allMessages ?? []).map((message) => message.text ?? message.c ?? message.content ?? "").join(" ");
          const part = snippet(source, term);
          if (part) found[chat.id] = { snippet: part, date: normalizeTs(chat.updated ?? chat.created, 0) };
        } catch { /* Title search remains available. */ }
        if (cancelled) return;
      }
      if (!cancelled) { setResult({ term, matches: found }); setSearchingContent(false); }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [chats, open, q]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setQ(""); } }}>
      <DialogContent className="top-[12%] max-h-[76dvh] max-w-[680px] translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Buscar conversaciones</DialogTitle>
        <div className="flex items-center gap-2 border-b border-e-line px-4">
          <Search className="size-4 shrink-0 text-e-dim" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversaciones…" aria-label="Buscar conversaciones"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-e-dim" />
          <button className="e-icon-btn" aria-label="Cerrar búsqueda" onClick={onClose}><X className="size-4" /></button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {!q && (
            <button className="e-side-item" onClick={() => { onNew(); onClose(); }}><SquarePen className="size-4" /> Nueva conversación</button>
          )}
          {chats === null && !err && <p className="px-3 py-6 text-center text-[14px] text-e-dim">Buscando…</p>}
          {searchingContent && <p className="px-3 py-2 text-[12px] text-e-dim">Buscando también dentro de las conversaciones…</p>}
          {err && <p className="px-3 py-6 text-center text-[14px] text-e-err">{err}</p>}
          {chats && groups.length === 0 && <p className="px-3 py-10 text-center text-[14px] text-e-dim">Sin resultados.</p>}
          {groups.map(([label, list]) => (
            <div key={label} className="mt-2">
              <h3 className="px-3 pb-1 text-[12px] font-medium text-e-dim">{label}</h3>
              {list.map((c) => {
                const ts = normalizeTs(c.updated ?? c.created, 0);
                return (
                  <button key={c.id} className="e-side-item" onClick={() => { onOpen(c.id); onClose(); setQ(""); }}>
                    <MessageCircle className="size-4 shrink-0 text-e-dim" />
                    <span className="min-w-0 flex-1"><span className="block truncate">{c.title || "Sin título"}</span>{matches[c.id] && <span className="mt-0.5 block truncate text-[12px] text-e-dim">{matches[c.id]?.snippet}</span>}</span>
                    {ts > 0 && <time className="shrink-0 text-[11px] text-e-dim">{new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</time>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

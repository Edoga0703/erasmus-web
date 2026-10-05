import { useMemo, useState } from "react";
import { MessageCircle, Search, SquarePen, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { groupByDate, useChatManifest } from "./ChatList";

/** ChatGPT-style centered search over conversation titles (manifest only; no full-text endpoint). */
export function SearchDialog({ open, onClose, onOpen, onNew, version }: { open: boolean; onClose: () => void; onOpen: (id: string) => void; onNew: () => void; version: number }) {
  const { chats, err } = useChatManifest(version + (open ? 1 : 0));
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const l = (chats ?? []).filter((c) => (c.title || "").toLowerCase().includes(q.trim().toLowerCase()));
    return groupByDate(l);
  }, [chats, q]);

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
          {err && <p className="px-3 py-6 text-center text-[14px] text-e-err">{err}</p>}
          {chats && groups.length === 0 && <p className="px-3 py-10 text-center text-[14px] text-e-dim">Sin resultados.</p>}
          {groups.map(([label, list]) => (
            <div key={label} className="mt-2">
              <h3 className="px-3 pb-1 text-[12px] font-medium text-e-dim">{label}</h3>
              {list.map((c) => (
                <button key={c.id} className="e-side-item" onClick={() => { onOpen(c.id); onClose(); setQ(""); }}>
                  <MessageCircle className="size-4 shrink-0 text-e-dim" />
                  <span className="truncate">{c.title || "Sin título"}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

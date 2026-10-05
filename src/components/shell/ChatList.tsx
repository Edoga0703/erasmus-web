import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import type { ChatMeta } from "@/lib/api/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function when(ms?: number): string {
  if (!ms) return "";
  const t = ms < 1e12 ? ms * 1000 : ms;
  const d = Date.now() - t;
  if (d < 60_000) return "ahora";
  if (d < 3_600_000) return `hace ${Math.floor(d / 60_000)} min`;
  if (d < 86_400_000) return `hace ${Math.floor(d / 3_600_000)} h`;
  return new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** History from GET /api/workspace/chats, updated desc. Delete stays disabled while delete_chat is PROPOSED. */
export function ChatList({ activeId, activeTitle, version, onOpen, onRename }: {
  activeId: string;
  activeTitle: string;
  version: number;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
}) {
  const [chats, setChats] = useState<ChatMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChatMeta | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.chats();
      setChats([...r.chats].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No se pudo cargar el historial.");
    }
  }, []);
  useEffect(() => { void load(); }, [load, version]);

  const save = async () => {
    if (!editing || !draft.trim()) return;
    setSaving(true);
    try {
      await onRename(editing.id, draft);
      setChats((cs) => cs?.map((c) => (c.id === editing.id ? { ...c, title: draft.trim() } : c)) ?? cs);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo renombrar.");
    } finally {
      setSaving(false);
    }
  };

  const isNew = chats !== null && !chats.some((c) => c.id === activeId);

  return (
    <>
      {isNew && <div className="mb-1 truncate rounded-md bg-e-bg3 px-2.5 py-1.5 text-[13px]">{activeTitle}</div>}
      {err && <p className="px-2.5 py-2 text-[12px] text-e-err">{err}</p>}
      {chats === null && !err && <p className="px-2.5 py-2 text-[12px] text-e-dim">Cargando…</p>}
      {chats?.length === 0 && !isNew && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[12.5px] text-e-dim">
          <MessageSquare className="size-5" />
          Aún no hay conversaciones.<br />Escribe tu primer mensaje para empezar.
        </div>
      )}
      {chats?.map((c) => (
        <div key={c.id} className={cn("group flex items-center gap-1 rounded-md pr-1 hover:bg-e-bg3", c.id === activeId && "bg-e-bg3")}>
          <button className="min-w-0 flex-1 px-2.5 py-1.5 text-left" onClick={() => onOpen(c.id)} aria-current={c.id === activeId}>
            <div className="truncate text-[13px]">{c.title || "Sin título"}</div>
            <div className="text-[10.5px] text-e-dim">{when(c.updated)}{c.messages_count ? ` · ${c.messages_count} mensajes` : ""}</div>
          </button>
          <button className="e-icon-btn shrink-0" aria-label={`Renombrar ${c.title}`} onClick={() => { setEditing(c); setDraft(c.title); }}>
            <Pencil className="size-3" />
          </button>
          <button className="e-icon-btn shrink-0 cursor-not-allowed opacity-40" disabled aria-label="Borrar (disponible pronto)" title="Borrar: disponible pronto">
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Renombrar conversación</DialogTitle></DialogHeader>
          <input
            autoFocus
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            aria-label="Nuevo título"
            className="w-full rounded-md border border-e-line bg-e-bg px-3 py-2 text-[14px] text-e-tx outline-none focus:border-e-acc2"
          />
          <p className="text-[11.5px] text-e-dim">Borrar conversaciones estará disponible pronto.</p>
          <DialogFooter>
            <button className="rounded-md px-3 py-1.5 text-[13px] text-e-dim hover:bg-e-bg3" onClick={() => setEditing(null)}>Cancelar</button>
            <button disabled={saving || !draft.trim()} className="rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground disabled:opacity-50" onClick={() => void save()}>Guardar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

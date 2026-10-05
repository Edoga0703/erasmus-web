import { DIRECT } from "@/lib/api/config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import type { ChatMeta } from "@/lib/api/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ms = (t?: number) => (!t ? 0 : t < 1e12 ? t * 1000 : t);

/** Groups like ChatGPT: Hoy / Ayer / 7 días anteriores / 30 días anteriores / Más antiguos. */
export function groupByDate<T extends { updated?: number }>(items: T[]): [string, T[]][] {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const day = 86_400_000, t0 = start.getTime();
  const buckets: [string, T[]][] = [["Hoy", []], ["Ayer", []], ["7 días anteriores", []], ["30 días anteriores", []], ["Más antiguos", []]];
  for (const it of items) {
    const t = ms(it.updated);
    const i = t >= t0 ? 0 : t >= t0 - day ? 1 : t >= t0 - 7 * day ? 2 : t >= t0 - 30 * day ? 3 : 4;
    buckets[i]![1].push(it);
  }
  return buckets.filter(([, l]) => l.length);
}

export function useChatManifest(version: number) {
  const [chats, setChats] = useState<ChatMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
  return { chats, setChats, err };
}

/** History from GET /api/workspace/chats, updated desc. Delete stays disabled while delete_chat is PROPOSED. */
export function ChatList({ activeId, activeTitle, version, onOpen, onRename }: {
  activeId: string;
  activeTitle: string;
  version: number;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
}) {
  const { chats, setChats, err } = useChatManifest(version);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => groupByDate(chats ?? []), [chats]);

  const save = async () => {
    const id = editing;
    const title = draft.trim();
    setEditing(null);
    if (!id || !title) return;
    const prev = chats;
    setChats((cs) => cs?.map((c) => (c.id === id ? { ...c, title } : c)) ?? cs);
    try {
      await onRename(id, title);
    } catch (e) {
      setChats(prev);
      toast.error(e instanceof ApiError ? e.message : "No se pudo renombrar.");
    }
  };
  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.select(), 30); }, [editing]);

  const isNew = chats !== null && !chats.some((c) => c.id === activeId);

  return (
    <>
      {err && <p className={"px-2.5 py-2 text-[13px] " + (DIRECT ? "text-e-dim" : "text-e-err")}>{DIRECT ? "El historial se activará cuando el puente esté instalado." : err}</p>}
      {chats === null && !err && <p className="px-2.5 py-2 text-[13px] text-e-dim">Cargando…</p>}
      {isNew && (
        <div className="mb-2">
          <div className="e-side-item bg-e-bg4"><span className="truncate">{activeTitle}</span></div>
        </div>
      )}
      {chats?.length === 0 && !isNew && <p className="px-2.5 py-3 text-[13px] text-e-dim">Aún no hay conversaciones.</p>}
      {groups.map(([label, list]) => (
        <div key={label} className="mb-3">
          <h3 className="px-2.5 pb-1 pt-2 text-[12px] font-medium text-e-dim">{label}</h3>
          {list.map((c) => (
            <div key={c.id} className={cn("group relative flex items-center rounded-[10px] hover:bg-e-bg4", c.id === activeId && "bg-e-bg4")}>
              {editing === c.id ? (
                <input
                  ref={inputRef}
                  value={draft}
                  maxLength={120}
                  aria-label="Nuevo título"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => void save()}
                  onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(null); }}
                  className="m-0.5 w-full rounded-lg border border-e-acc2 bg-e-bg2 px-2 py-1.5 text-[14px] text-e-tx outline-none"
                />
              ) : (
                <>
                  <button className="min-w-0 flex-1 px-2.5 py-2 text-left" onClick={() => onOpen(c.id)} aria-current={c.id === activeId}>
                    <div className="truncate text-[14px]">{c.title || "Sin título"}</div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label={`Opciones de ${c.title}`}
                        className={cn("mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-e-dim hover:text-e-tx md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100", c.id === activeId && "md:opacity-100")}>
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="e-pop min-w-48 p-1.5">
                      <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => { setDraft(c.title); setEditing(c.id); }}>
                        <Pencil className="size-4" /> Cambiar nombre
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled className="gap-2.5 rounded-lg px-3 py-2 text-[14px] text-e-err" title="Disponible pronto">
                        <Trash2 className="size-4" /> Eliminar <span className="ml-auto text-[11px] text-e-dim">disponible pronto</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, ArrowDown, ChevronDown, Download, FileText, FolderOpen, ImageIcon, Printer, Info, Moon, PanelLeft, RefreshCw, Search, Settings, SquarePen, Sun, TimerReset, WifiOff, X } from "lucide-react";
import { sandboxDir, useChat, type Attachment } from "@/hooks/use-chat";
import { useConnection } from "@/hooks/use-connection";
import { useIsMobile } from "@/hooks/use-mobile";
import { DIRECT, displayModel } from "@/lib/api/config";
import { api, ApiError } from "@/lib/api/client";
import { setTheme, useTheme } from "@/lib/theme";
import { MessageView } from "@/components/chat/MessageView";
import { Composer } from "@/components/chat/Composer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChatList } from "./ChatList";
import { SearchDialog } from "./SearchDialog";
import { FilesPanel } from "@/components/files/FilesPanel";
import { SettingsDialog } from "./SettingsDialog";
import { UsageMeter } from "./UsageMeter";
import { ImagesDialog, ImageViewer, collectImages, type ChatImage } from "@/components/chat/Images";
import { downloadMarkdown, printAsPdf } from "@/lib/export-chat";
import { logout } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

const LS = { side: "erasmus.side.w", collapsed: "erasmus.side.collapsed", panel: "erasmus.panel.w" };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
function readNum(k: string, d: number) { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } }

/** Drag handle for resizable panels; `dir` = +1 grows to the right, -1 grows to the left. */
function Resizer({ onDrag, dir, label }: { onDrag: (dx: number) => void; dir: 1 | -1; label: string }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    let x = e.clientX;
    const move = (ev: PointerEvent) => { onDrag((ev.clientX - x) * dir); x = ev.clientX; };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return <div role="separator" aria-orientation="vertical" aria-label={label} onPointerDown={start}
    className={cn("absolute inset-y-0 z-10 w-1.5 cursor-col-resize hover:bg-e-line", dir === 1 ? "-right-0.5" : "-left-0.5")} />;
}

export function AppShell() {
  const conn = useConnection();
  const model = conn.status?.brand_model ?? "erasmus-v1";
  const chat = useChat({ model });
  const mobile = useIsMobile();
  const theme = useTheme();
  const [sideOpen, setSideOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sideW, setSideW] = useState(260);
  const [panelW, setPanelW] = useState(460);
  const [filesOpen, setFilesOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"activity" | "files" | "artifacts">("files");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [viewImg, setViewImg] = useState<ChatImage | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [draft] = useState<{ text: string; n: number }>();
  const [openingChat, setOpeningChat] = useState(false);
  const scroller = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    chat.stop();
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    void navigate({ to: "/entrar", replace: true });
  };
  const sessionPlan = getSession()?.plan;

  useEffect(() => {
    setSideW(readNum(LS.side, 260)); setPanelW(readNum(LS.panel, 460));
    try { setCollapsed(localStorage.getItem(LS.collapsed) === "1"); } catch { /* */ }
  }, []);
  const persist = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };
  useEffect(() => persist(LS.side, String(sideW)), [sideW]);
  useEffect(() => persist(LS.panel, String(panelW)), [panelW]);
  useEffect(() => persist(LS.collapsed, collapsed ? "1" : "0"), [collapsed]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);
  const onScroll = () => { const el = scroller.current; if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };
  const toBottom = () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });

  const visible = chat.messages.filter((m) => !m.hidden);
  const down = conn.state === "offline" || conn.state === "denied";
  const lastAssistant = [...visible].reverse().find((m) => m.role === "assistant" && !m.kind)?.id;
  const lastUser = [...visible].reverse().find((m) => m.role === "user")?.content;

  const regenerate = useCallback(() => { if (lastUser) void chat.send(lastUser); }, [lastUser, chat]);
  const newChat = () => { chat.reset(); setSideOpen(false); };
  const openChat = (id: string) => { setSideOpen(false); setOpeningChat(true); chat.open(id).catch(() => toast.error("No se pudo abrir la conversación.")).finally(() => setOpeningChat(false)); };

  /** Downscale photos (max 1600 px, JPEG) so they travel inline to the model. */
  const imageToDataUrl = async (f: File): Promise<string> => {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL(f.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
  };

  /** Upload attachments to this conversation's sandbox, then send the message showing them as tiles. */
  const sendWithFiles = async (text: string, files: File[]) => {
    const atts: Attachment[] = [];
    for (const f of files) {
      const isImg = f.type.startsWith("image/");
      const att: Attachment = { name: f.name, size: f.size, url: isImg ? URL.createObjectURL(f) : undefined };
      if (isImg) { try { att.image = await imageToDataUrl(f); } catch { toast.error(`No se pudo leer ${f.name}.`); } }
      const textual = !isImg && f.type !== "application/pdf";
      if (textual && DIRECT) {
        if (f.size <= 200_000) att.text = await f.text(); else toast.error(`${f.name} supera 200 KB; no se puede enviar.`);
      } else if (textual && f.size <= 2_000_000) {
        try {
          const path = `${sandboxDir(chat.chatId)}/${f.name}`;
          await api.fsWrite(path, await f.text());
          att.path = path;
        } catch (e) { toast.error(e instanceof ApiError ? e.message : `No se pudo subir ${f.name}.`); }
      } else if (textual) toast.error(`${f.name} supera 2 MB.`);
      atts.push(att);
    }
    if (atts.some((a) => a.path)) window.dispatchEvent(new Event("erasmus:files-changed"));
    void chat.send(text, atts);
  };

  const rail = !mobile && collapsed;
  const sidebar = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 px-2">
        {!rail && (
          <button onClick={newChat} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-e-bg4" aria-label="Erasmus, nueva conversación">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-e-acc text-[13px] font-bold text-e-bg2">E</span>
            <span className="truncate text-[15px] font-semibold">Erasmus</span>
          </button>
        )}
        <button className="e-icon-btn shrink-0" aria-label={mobile ? "Cerrar barra lateral" : rail ? "Abrir barra lateral" : "Cerrar barra lateral"}
          onClick={() => (mobile ? setSideOpen(false) : setCollapsed((c) => !c))}>
          {mobile ? <X className="size-5" /> : <PanelLeft className="size-5" />}
        </button>
      </div>
      <div className={cn("flex flex-col gap-0.5 px-2", rail && "items-center")}>
        {[
          { label: "Nueva conversación", Icon: SquarePen, on: newChat, kbd: "" },
          { label: "Buscar conversaciones", Icon: Search, on: () => { setSearchOpen(true); setSideOpen(false); }, kbd: "Ctrl K" },
          { label: "Imágenes", Icon: ImageIcon, on: () => { setImagesOpen(true); setSideOpen(false); }, kbd: "" },
          { label: "Archivos", Icon: FolderOpen, on: () => { setPanelTab("files"); setFilesOpen(true); setSideOpen(false); }, kbd: "" },
        ].map(({ label, Icon, on, kbd }) =>
          rail ? (
            <button key={label} className="e-icon-btn text-e-tx" aria-label={label} title={label} onClick={on}><Icon className="size-5" /></button>
          ) : (
            <button key={label} className="e-side-item group" onClick={on}>
              <Icon className="size-[18px] shrink-0" /> <span className="flex-1">{label}</span>
              {kbd && <span className="hidden text-[12px] text-e-dim group-hover:inline">{kbd}</span>}
            </button>
          ),
        )}
      </div>
      <nav className={cn("mt-4 flex-1 overflow-y-auto px-2", rail && "invisible")}>
        {!rail && <ChatList activeId={chat.chatId} activeTitle={chat.title} version={chat.listVersion} onOpen={openChat} onRename={chat.rename} />}
      </nav>
      <div className={cn("shrink-0 p-2", rail && "flex justify-center")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={rail ? "e-icon-btn" : "e-side-item"} aria-label="Menú de cuenta">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-e-ok text-[13px] font-semibold text-e-bg2">TU</span>
              {!rail && <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[14px]">Mi cuenta</span><span className="block text-[12px] text-e-dim">{sessionPlan ? `Plan ${sessionPlan}` : "Erasmus Web"}</span></span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="e-pop w-60 p-1.5">
            <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => { setSettingsOpen(true); setSideOpen(false); }}><Settings className="size-4" /> Ajustes</DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />} Tema {theme === "dark" ? "claro" : "oscuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => { setSettingsOpen(true); setSideOpen(false); }}><Info className="size-4" /> Acerca de</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => void signOut()}><LogOut className="size-4" /> Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  const empty = visible.length === 0;
  const composer = (
    <Composer busy={chat.busy} disabled={down} onSend={(t, f) => void sendWithFiles(t, f)} onStop={chat.stop} draft={draft} centered={empty} />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-e-bg2 text-e-tx">
      {mobile ? (
        <>
          {sideOpen && <div className="e-overlay fixed inset-0 z-30" onClick={() => setSideOpen(false)} />}
          <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[86vw] max-w-[320px] flex-col bg-e-bg transition-transform duration-200", sideOpen ? "translate-x-0" : "-translate-x-full")} aria-label="Barra lateral">
            {sidebar}
          </aside>
        </>
      ) : (
        <aside className="relative flex shrink-0 flex-col border-r border-e-line bg-e-bg transition-[width] duration-150" style={{ width: rail ? 56 : sideW }} aria-label="Barra lateral">
          {sidebar}
          {!rail && <Resizer dir={1} label="Redimensionar barra lateral" onDrag={(dx) => setSideW((w) => clamp(w + dx, 220, 420))} />}
        </aside>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
          {mobile && <button className="e-icon-btn text-e-tx" aria-label="Abrir barra lateral" onClick={() => setSideOpen(true)}><PanelLeft className="size-5" /></button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[17px] font-medium hover:bg-e-bg3" aria-label="Opciones de conversación">
                <span className="truncate">{chat.temporary ? "Conversación temporal" : "Erasmus"}</span>
                {!chat.temporary && displayModel(model) !== "Erasmus" && <span className="hidden truncate text-e-dim sm:inline">{displayModel(model)}</span>}
                <ChevronDown className="size-4 shrink-0 text-e-dim" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="e-pop min-w-60 p-1.5">
              <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2" onSelect={() => chat.startTemporary()}><TimerReset /> Nueva conversación temporal</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2" onSelect={() => setSettingsOpen(true)}><Settings /> Modelo y conexión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {conn.state !== "online" && <span className="ml-1 flex shrink-0 items-center gap-1.5 text-[12px] text-e-dim"><i className={cn("inline-block size-2 rounded-full", conn.state === "checking" ? "bg-e-dim" : "bg-e-err")} /><span className="hidden sm:inline">{conn.state === "checking" ? "Conectando…" : "Sin conexión"}</span></span>}
          <span className="flex-1" />
          <h1 className="sr-only">{chat.title}</h1>
          <UsageMeter />
          {!empty && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="e-icon-btn text-e-tx" aria-label="Exportar conversación" title="Exportar conversación"><Download className="size-5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="e-pop w-56 p-1.5">
                <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => downloadMarkdown(chat.title, chat.messages)}><FileText className="size-4" /> Descargar Markdown</DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2 text-[14px]" onSelect={() => { if (!printAsPdf(chat.title, chat.messages)) toast.error("El navegador bloqueó la ventana. Permite ventanas emergentes para exportar en PDF."); }}><Printer className="size-4" /> Guardar como PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button className={cn("e-icon-btn text-e-tx", filesOpen && "bg-e-bg3")} aria-label="Archivos y actividad" aria-pressed={filesOpen} onClick={() => { setPanelTab("files"); setFilesOpen((o) => !o); }}><FolderOpen className="size-5" /></button>
          {mobile && <button className="e-icon-btn text-e-tx" aria-label="Nueva conversación" onClick={newChat}><SquarePen className="size-5" /></button>}
        </header>

        {down && (
          <div className="e-err-banner mx-4 mt-1 flex items-center gap-3 px-3 py-2 text-[13px]" role="alert">
            <WifiOff className="size-4 shrink-0" />
            <span className="flex-1">{conn.state === "denied" ? conn.message : "Conexión caída: " + conn.message}</span>
            <button onClick={() => void conn.retry()} className="inline-flex items-center gap-1 rounded-full border border-current px-2.5 py-1 text-[12px]"><RefreshCw className="size-3" /> Reintentar</button>
          </div>
        )}

        {empty ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-7 pb-[12vh]">
            <h2 className="px-6 text-center text-[26px] font-normal tracking-tight sm:text-[28px]">¿En qué puedo ayudarte?</h2>
            {composer}
          </section>
        ) : (
          <>
            <section ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto" onClick={(e) => {
              const t = e.target as HTMLElement;
              if (t.tagName === "IMG" && t.closest(".e-md")) { const im = t as HTMLImageElement; setViewImg({ src: im.currentSrc || im.src, alt: im.alt || "Imagen", fromUser: false }); }
            }}>
              <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 pb-10 pt-4 sm:px-6">
                {openingChat && <div className="space-y-5 py-6" role="status" aria-label="Abriendo conversación"><div className="h-4 w-2/3 animate-pulse rounded bg-e-bg3" /><div className="h-4 w-full animate-pulse rounded bg-e-bg3" /><div className="h-4 w-4/5 animate-pulse rounded bg-e-bg3" /></div>}
                {visible.map((m) => (
                  <MessageView key={m.id} m={m} isLast={m.id === lastAssistant} busy={chat.busy}
                    onRegenerate={m.id === lastAssistant ? regenerate : undefined} onBranch={m.role === "assistant" ? () => void chat.branchFrom(m.id) : undefined} onRetry={m.error?.retryable ? chat.retry : undefined} onContinue={m.id === lastAssistant ? chat.continueLast : undefined} />
                ))}
              </div>
            </section>
            {!atBottom && (
              <button onClick={toBottom} aria-label="Ir al final" className="e-pop absolute bottom-32 left-1/2 z-10 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full">
                <ArrowDown className="size-4" />
              </button>
            )}
            {chat.limit && (
              <div className="e-err-banner mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-3xl flex-wrap items-center gap-2 px-3 py-2 text-[13px]" role="alert" data-limit={chat.limit.file ? "file" : "context"}>
                <span className="flex-1">{chat.limit.message}</span>
                {!chat.limit.file && <button type="button" onClick={() => chat.reset()} className="rounded-full bg-e-acc px-3 py-1 text-[13px] font-medium text-e-bg2">Nueva conversación</button>}
                <button onClick={chat.dismissLimit} aria-label="Cerrar aviso"><X className="size-3.5" /></button>
              </div>
            )}
            {chat.error && (
              <div className="e-err-banner mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-2 px-3 py-2 text-[13px]" role="alert">
                <span className="flex-1">{chat.error}</span>
                <button onClick={chat.dismissError} aria-label="Cerrar aviso"><X className="size-3.5" /></button>
              </div>
            )}
            {composer}
          </>
        )}
      </main>
      {filesOpen && (
        mobile ? (
          <FilesPanel convId={chat.chatId} refreshKey={`${chat.busy}-${chat.messages.length}`} messages={chat.messages} initialTab={panelTab} onClose={() => setFilesOpen(false)} />
        ) : (
          <div className="relative flex shrink-0" style={{ width: panelW }}>
            <Resizer dir={-1} label="Redimensionar panel de archivos" onDrag={(dx) => setPanelW((w) => clamp(w + dx, 320, 860))} />
            <FilesPanel convId={chat.chatId} refreshKey={`${chat.busy}-${chat.messages.length}`} messages={chat.messages} initialTab={panelTab} onClose={() => setFilesOpen(false)} />
          </div>
        )
      )}
      {imagesOpen && <ImagesDialog images={collectImages(chat.messages)} onClose={() => setImagesOpen(false)} />}
      {viewImg && <ImageViewer img={viewImg} onClose={() => setViewImg(null)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={openChat} onNew={newChat} version={chat.listVersion} />
    </div>
  );
}

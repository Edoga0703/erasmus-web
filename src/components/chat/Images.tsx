import { useEffect, useState } from "react";
import { Download, ExternalLink, ImageIcon, X } from "lucide-react";
import { API_BASE } from "@/lib/api/config";
import type { UIMessage } from "@/hooks/use-chat";

export interface ChatImage { src: string; alt: string; fromUser: boolean }

const abs = (u: string) => (API_BASE.startsWith("http") && u.startsWith("/api/images/") ? API_BASE + u : u);

/** Every image in the conversation: model-generated (Markdown/HTML img) and user photo attachments. */
export function collectImages(messages: UIMessage[]): ChatImage[] {
  const out: ChatImage[] = [];
  const seen = new Set<string>();
  const add = (src: string, alt: string, fromUser: boolean) => { if (src && !seen.has(src)) { seen.add(src); out.push({ src, alt, fromUser }); } };
  for (const m of messages) {
    if (m.hidden) continue;
    if (m.role === "user") m.attachments?.forEach((a) => a.url && add(a.url, a.name, true));
    else {
      for (const r of m.content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) add(abs(r[2]!), r[1] || "Imagen", false);
      for (const r of m.content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) add(abs(r[1]!), "Imagen", false);
    }
  }
  return out;
}

async function download(src: string, name: string) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w.-]+/g, "_").slice(0, 40) || "imagen"}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch {
    window.open(src, "_blank", "noopener");
  }
}

/** Full-screen viewer with download, like ChatGPT's image lightbox. */
export function ImageViewer({ img, onClose }: { img: ChatImage; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="e-overlay fixed inset-0 z-[60] flex flex-col" role="dialog" aria-modal="true" aria-label="Vista de imagen" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-end gap-1 p-3" onClick={(e) => e.stopPropagation()}>
        <button className="e-icon-btn bg-e-bg2 text-e-tx" aria-label="Descargar imagen" onClick={() => void download(img.src, img.alt)}><Download className="size-5" /></button>
        <button className="e-icon-btn bg-e-bg2 text-e-tx" aria-label="Abrir en pestaña nueva" onClick={() => window.open(img.src, "_blank", "noopener")}><ExternalLink className="size-5" /></button>
        <button className="e-icon-btn bg-e-bg2 text-e-tx" aria-label="Cerrar" onClick={onClose}><X className="size-5" /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        <img src={img.src} alt={img.alt} className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

/** "Imágenes" gallery of the current conversation. */
export function ImagesDialog({ images, onClose }: { images: ChatImage[]; onClose: () => void }) {
  const [view, setView] = useState<ChatImage | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !view && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, view]);
  return (
    <div className="e-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Imágenes" onClick={(e) => e.stopPropagation()}
        className="e-pop flex h-full w-full flex-col overflow-hidden sm:h-[80vh] sm:max-w-4xl sm:rounded-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-e-line px-4">
          <h2 className="text-[17px] font-medium">Imágenes</h2>
          <button className="e-icon-btn" aria-label="Cerrar" onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {images.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-e-dim">
              <ImageIcon className="size-8" />
              <p className="text-[15px] text-e-tx">Aún no hay imágenes</p>
              <p className="max-w-xs text-[13px]">Las imágenes que crees con Erasmus o adjuntes en esta conversación aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {images.map((im) => (
                <button key={im.src} className="group relative aspect-square overflow-hidden rounded-xl bg-e-bg3" onClick={() => setView(im)} aria-label={`Ver ${im.alt}`}>
                  <img src={im.src} alt={im.alt} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                  {im.fromUser && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-e-bg2/90 px-2 py-0.5 text-[11px]">Adjunta</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {view && <ImageViewer img={view} onClose={() => setView(null)} />}
    </div>
  );
}

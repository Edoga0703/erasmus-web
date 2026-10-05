import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { highlightWithin, renderMarkdown } from "@/lib/markdown";
import { splitRich } from "@/lib/charts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chart } from "./Chart";
import { Mermaid } from "./Mermaid";

const COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
const EYE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const PREVIEWABLE = new Set(["html", "svg", "xml"]);

/** Wraps sanitized <pre> nodes in a ChatGPT-style frame (language + Copiar + Vista previa). Only static markup is injected; code text is read via textContent. */
function decorate(root: HTMLElement, onPreview: (code: string, lang: string) => void) {
  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement?.classList.contains("e-code")) return;
    const code = pre.querySelector("code");
    const lang = (code?.className.match(/language-([\w+-]+)/)?.[1] ?? "").toLowerCase();
    const wrap = document.createElement("div");
    wrap.className = "e-code";
    const head = document.createElement("div");
    head.className = "e-code-head";
    const label = document.createElement("span");
    label.className = "e-code-lang";
    label.textContent = lang || "código";
    head.appendChild(label);
    if (PREVIEWABLE.has(lang)) {
      const pv = document.createElement("button");
      pv.type = "button";
      pv.innerHTML = `${EYE_SVG}<span>Vista previa</span>`;
      pv.onclick = () => onPreview(code?.textContent ?? "", lang);
      head.appendChild(pv);
    }
    const cp = document.createElement("button");
    cp.type = "button";
    cp.setAttribute("aria-label", "Copiar código");
    cp.innerHTML = `${COPY_SVG}<span>Copiar</span>`;
    cp.onclick = () => {
      void navigator.clipboard?.writeText(code?.textContent ?? pre.textContent ?? "");
      cp.innerHTML = `${CHECK_SVG}<span>Copiado</span>`;
      setTimeout(() => { cp.innerHTML = `${COPY_SVG}<span>Copiar</span>`; }, 1600);
    };
    head.appendChild(cp);
    pre.replaceWith(wrap);
    wrap.append(head, pre);
  });
}

function Html({ source, streaming }: { source: string; streaming?: boolean | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ code: string; lang: string } | null>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);
  useLayoutEffect(() => {
    // During streaming the HTML changes rapidly. Decorating/highlighting each
    // partial code fence mutates the same DOM React is replacing and causes
    // visible overlap. Keep the sanitized Markdown plain until the turn ends.
    if (streaming) return;
    if (!ref.current) return;
    decorate(ref.current, (code, lang) => setPreview({ code, lang }));
    highlightWithin(ref.current);
  }, [source, streaming]);
  return (
    <>
      <div ref={ref} className="e-md" dangerouslySetInnerHTML={{ __html: html }} />
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="h-[85dvh] max-w-4xl grid-rows-[auto_1fr] p-0 sm:rounded-2xl">
          <DialogHeader className="px-5 pt-4"><DialogTitle className="text-[15px]">Vista previa ({preview?.lang})</DialogTitle></DialogHeader>
          {preview && (
            <iframe
              title="Vista previa del código"
              sandbox="allow-scripts allow-popups"
              srcDoc={preview.lang === "html" ? preview.code : `<!doctype html><body style="margin:0;display:grid;place-items:center;min-height:100vh">${preview.code}</body>`}
              className="e-frame h-full w-full rounded-b-2xl border-t border-e-line"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The ONLY place model Markdown becomes HTML: always marked + DOMPurify (reference rules). Closed chart/mermaid fences get rich renderers. */
export function Markdown({ source, streaming }: { source: string; streaming?: boolean | undefined }) {
  const parts = useMemo(() => splitRich(source), [source]);
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "chart" ? <Chart key={i} source={p.text} /> : p.kind === "mermaid" ? <Mermaid key={i} source={p.text} /> : p.text.trim() ? <Html key={i} source={p.text} streaming={streaming} /> : null,
      )}
    </>
  );
}

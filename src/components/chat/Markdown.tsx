import { memo, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openArtifact } from "@/lib/artifacts";
import { highlightWithin, renderMarkdown } from "@/lib/markdown";
import { splitRich } from "@/lib/charts";
import { Chart } from "./Chart";
import { Mermaid } from "./Mermaid";

const COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
const EYE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const PREVIEWABLE = new Set(["html", "svg"]);
type ArtifactCard = { node: HTMLElement; code: string; lang: string };

/** Wraps sanitized <pre> nodes in a ChatGPT-style frame (language + Copiar + Vista previa). Only static markup is injected; code text is read via textContent. */
function decorate(root: HTMLElement, onPreview: (code: string, lang: string) => void): ArtifactCard[] {
  const cards: ArtifactCard[] = [];
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
    const source = code?.textContent ?? "";
    if (PREVIEWABLE.has(lang) && source.trimEnd().split("\n").length > 10) {
      const node = document.createElement("div");
      node.className = "e-artifact-card";
      wrap.before(node);
      cards.push({ node, code: source, lang });
    }
  });
  return cards;
}

const MarkdownHtml = memo(function MarkdownHtml({ html, divRef }: { html: string; divRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={divRef} className="e-md" dangerouslySetInnerHTML={{ __html: html }} />;
});

function Html({ source, streaming }: { source: string; streaming?: boolean | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<ArtifactCard[]>([]);
  const html = useMemo(() => renderMarkdown(source), [source]);
  useLayoutEffect(() => {
    // During streaming the HTML changes rapidly. Decorating/highlighting each
    // partial code fence mutates the same DOM React is replacing and causes
    // visible overlap. Keep the sanitized Markdown plain until the turn ends.
    if (streaming) { setCards([]); return; }
    if (!ref.current) return;
    const root = ref.current;
    const applyCodeChrome = () => {
      const next = decorate(root, openArtifact);
      setCards((current) => [...current.filter((card) => root.contains(card.node)), ...next]);
      highlightWithin(root);
    };
    applyCodeChrome();
    // A parent recovery render can replace dangerouslySetInnerHTML after this
    // effect without changing `source`; re-apply the static code chrome once.
    const observer = new MutationObserver(() => {
      if (root.querySelector("pre:not(.e-code pre)")) applyCodeChrome();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [source, streaming]);
  return (
    <>
      <MarkdownHtml html={html} divRef={ref} />
      {cards.map((card, i) => createPortal(
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-e-line bg-e-bg px-4 py-3">
          <Code2 className="size-7 shrink-0 text-e-dim" />
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{card.lang === "svg" ? "Gráfico vectorial" : "Aplicación web"}</p><p className="text-xs text-e-dim">Componente interactivo · {card.lang === "svg" ? "SVG" : "HTML / Tailwind CSS"}</p></div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openArtifact(card.code, card.lang)}>Abrir vista previa <ArrowUpRight className="size-4" /></Button>
        </div>, card.node, String(i),
      ))}
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

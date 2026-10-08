import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Ranges leave React-owned text and sanitized Markdown untouched. */
export function findSearchRanges(root: HTMLElement, query: string): Range[] {
  const needle = query.toLocaleLowerCase();
  if (!needle) return [];
  const ranges: Range[] = [];
  root.querySelectorAll<HTMLElement>("[data-search-text], .e-md").forEach((container) => {
    if (container.closest('[hidden], [aria-hidden="true"]')) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.parentElement?.closest('button, script, style, [hidden], [aria-hidden="true"], .e-code-head') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes: { node: Text; start: number; end: number }[] = [];
    let text = "";
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      nodes.push({ node, start: text.length, end: text.length + node.length });
      text += node.data;
    }
    const haystack = text.toLocaleLowerCase();
    for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) {
      const start = nodes.find((n) => n.end > at);
      const end = nodes.find((n) => n.end >= at + needle.length);
      if (!start || !end) continue;
      const range = document.createRange();
      range.setStart(start.node, at - start.start);
      range.setEnd(end.node, at + needle.length - end.start);
      ranges.push(range);
    }
  });
  return ranges;
}

type HighlightWindow = Window & { Highlight?: new (...ranges: Range[]) => unknown };
type HighlightCSS = typeof CSS & { highlights?: Map<string, unknown> };

export function InChatSearch({ rootRef, onClose }: { rootRef: RefObject<HTMLElement | null>; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) { setRanges([]); return; }
    let frame = 0;
    const update = () => { setRanges(findSearchRanges(root, query.trim())); };
    update();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [query, rootRef]);
  useEffect(() => { setActive(0); }, [query]);
  const selected = ranges.length ? active % ranges.length : 0;
  useEffect(() => {
    const registry = (globalThis.CSS as HighlightCSS | undefined)?.highlights;
    const Highlight = (window as HighlightWindow).Highlight;
    if (registry && Highlight) {
      registry.set("erasmus-search", new Highlight(...ranges));
      registry.set("erasmus-search-active", new Highlight(...(ranges[selected] ? [ranges[selected]] : [])));
    }
    const target = ranges[selected]?.startContainer.parentElement;
    target?.scrollIntoView?.({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    return () => { registry?.delete("erasmus-search"); registry?.delete("erasmus-search-active"); };
  }, [ranges, selected]);
  const move = (delta: number) => { if (ranges.length) setActive((selected + delta + ranges.length) % ranges.length); };
  return <div role="search" aria-label="Buscar en esta conversación" className="mx-3 mb-2 flex shrink-0 items-center gap-1 rounded-lg border border-e-line bg-e-bg2 p-1.5 shadow-e sm:ml-auto sm:w-[420px]" onKeyDown={(e) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    if (e.key === "Enter") { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
  }}>
    <Search className="mx-1 size-4 shrink-0 text-e-dim" />
    <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en esta conversación..." aria-label="Buscar en esta conversación" className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-e-dim" />
    <span aria-live="polite" className="min-w-12 shrink-0 text-center text-[11px] tabular-nums text-e-dim">{ranges.length ? `${selected + 1} de ${ranges.length}` : query ? "Sin coincidencias" : "0 de 0"}</span>
    <Button variant="ghost" size="icon-sm" aria-label="Coincidencia anterior" title="Coincidencia anterior" disabled={!ranges.length} onClick={() => move(-1)}><ChevronUp /></Button>
    <Button variant="ghost" size="icon-sm" aria-label="Coincidencia siguiente" title="Coincidencia siguiente" disabled={!ranges.length} onClick={() => move(1)}><ChevronDown /></Button>
    <Button variant="ghost" size="icon-sm" aria-label="Cerrar búsqueda" title="Cerrar búsqueda" onClick={onClose}><X /></Button>
  </div>;
}
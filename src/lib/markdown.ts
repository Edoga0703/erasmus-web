import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";

/** Same sanitizer rules as the desktop reference (index.html:1768). */
export const PURIFY_CONFIG = {
  FORBID_TAGS: ["iframe", "object", "embed", "script", "form", "noscript"],
  FORBID_ATTR: ["srcdoc"],
};

export function sanitize(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  return sanitize(html);
}

export function highlight(code: string, lang?: string): string {
  try {
    const out = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }) : hljs.highlightAuto(code);
    return sanitize(out.value);
  } catch {
    return sanitize(code.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
  }
}

/** Post-process rendered markdown: highlight <pre><code> blocks in place. */
export function highlightWithin(el: HTMLElement): void {
  el.querySelectorAll("pre code").forEach((node) => {
    const n = node as HTMLElement;
    if (n.dataset.hl) return;
    hljs.highlightElement(n);
    n.dataset.hl = "1";
  });
}

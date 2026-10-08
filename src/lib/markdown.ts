import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { API_BASE } from "@/lib/api/config";

/** Same sanitizer rules as the desktop reference (index.html:1768). */
export const PURIFY_CONFIG = {
  FORBID_TAGS: ["iframe", "object", "embed", "script", "form", "noscript"],
  FORBID_ATTR: ["srcdoc"],
  ADD_ATTR: ["role", "aria-hidden"],
};

const ALERTS = {
  NOTE: ["Nota", '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'],
  TIP: ["Consejo", '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 3H9Z"/>'],
  IMPORTANT: ["Importante", '<path d="M12 3 3 12l9 9 9-9Z"/><path d="M12 8v5m0 3v1"/>'],
  WARNING: ["Advertencia", '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v1"/>'],
  CAUTION: ["Precaución", '<path d="m8 3-5 5v8l5 5h8l5-5V8l-5-5Z"/><path d="M12 7v7m0 3v1"/>'],
} as const;

function callouts(html: string): string {
  if (typeof document === "undefined") return html;
  const root = document.createElement("div");
  root.innerHTML = sanitize(html);
  root.querySelectorAll("blockquote").forEach((quote) => {
    const first = quote.firstElementChild;
    const text = first?.firstChild;
    if (first?.tagName !== "P" || text?.nodeType !== Node.TEXT_NODE) return;
    const match = text.textContent?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s|$)/);
    const type = match?.[1] as keyof typeof ALERTS | undefined;
    if (!match || !type) return;
    text.textContent = (text.textContent ?? "").slice(match[0].length);
    if (first.firstElementChild?.tagName === "BR" && !text.textContent?.trim()) first.firstElementChild.remove();
    if (!first.textContent?.trim() && !first.querySelector("img")) first.remove();
    const box = document.createElement("div");
    box.className = `e-callout e-callout-${type.toLowerCase()}`;
    box.setAttribute("role", "note");
    const [label, icon] = ALERTS[type];
    box.innerHTML = `<div class="e-callout-head"><svg class="e-callout-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg><span>${label}</span></div>`;
    const body = document.createElement("div"); body.className = "e-callout-body";
    while (quote.firstChild) body.appendChild(quote.firstChild);
    box.appendChild(body); quote.replaceWith(box);
  });
  return root.innerHTML;
}

export function sanitize(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

export function renderMarkdown(md: string): string {
  // Generated image paths belong to the same Erasmus API origin.
  const src = API_BASE.startsWith("http") ? md.replace(/(\]\(|src=["'])\/api\/images\//g, `$1${API_BASE}/api/images/`) : md;
  const html = marked.parse(src, { async: false, gfm: true, breaks: true }) as string;
  return sanitize(callouts(html));
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
    if (n.dataset['hl']) return;
    hljs.highlightElement(n);
    n.dataset['hl'] = "1";
  });
}

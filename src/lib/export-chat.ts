import type { UIMessage } from "@/hooks/use-chat";
import { renderMarkdown } from "@/lib/markdown";

const fileName = (title: string, ext: string) => `${(title || "conversacion").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "conversacion"}.${ext}`;
const visible = (ms: UIMessage[]) => ms.filter((m) => !m.hidden && m.content.trim());

export function chatToMarkdown(title: string, messages: UIMessage[]): string {
  const body = visible(messages).map((m) => `### ${m.role === "user" ? "Tú" : "Erasmus"}\n\n${m.content.trim()}`).join("\n\n---\n\n");
  return `# ${title}\n\n_Exportado desde Erasmus el ${new Date().toLocaleString("es-ES")}_\n\n${body}\n`;
}

export function downloadMarkdown(title: string, messages: UIMessage[]): void {
  const blob = new Blob([chatToMarkdown(title, messages)], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName(title, "md");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Print-ready page (Guardar como PDF in the browser dialog); content goes through the audited Markdown sanitizer. */
export function printAsPdf(title: string, messages: UIMessage[]): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const rows = visible(messages).map((m) => m.role === "user"
    ? `<section class="u"><div class="who">Tú</div><div class="bubble">${esc(m.content).replace(/\n/g, "<br>")}</div></section>`
    : `<section class="a"><div class="who">Erasmus</div>${renderMarkdown(m.content)}</section>`).join("");
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0d0d0d;max-width:760px;margin:40px auto;padding:0 24px}
h1.t{font-size:22px;margin:0 0 4px}.d{color:#5d5d5d;font-size:12px;margin-bottom:28px}
section{margin:0 0 22px;break-inside:avoid-page}.who{font-size:12px;font-weight:600;color:#5d5d5d;margin-bottom:4px}
.bubble{background:#f4f4f4;border-radius:18px;padding:10px 16px;display:inline-block}
pre{background:#f6f6f6;border:1px solid #e5e5e5;border-radius:10px;padding:12px;white-space:pre-wrap;font-size:12.5px}
code{font-family:ui-monospace,Menlo,monospace}table{border-collapse:collapse}td,th{border:1px solid #e5e5e5;padding:6px 10px}img{max-width:100%}
</style></head><body><h1 class="t">${esc(title)}</h1><div class="d">Erasmus · ${esc(new Date().toLocaleString("es-ES"))}</div>${rows}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

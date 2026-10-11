import DOMPurify from "dompurify";

export interface Artifact { title: string; code: string; lang: string }
export const ARTIFACT_EVENT = "erasmus:open-artifact";
export const ARTIFACT_SANDBOX = "allow-scripts allow-modals allow-forms";

export function isArtifact(value: unknown): value is Artifact {
  if (!value || typeof value !== "object") return false;
  const a = value as Partial<Artifact>;
  return typeof a.title === "string" && typeof a.code === "string" && (a.lang === "html" || a.lang === "svg");
}

export function extractArtifactTitle(code: string, lang: string): string {
  if (lang === "svg") return "Gráfico vectorial";
  const m = code.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m && m[1]?.trim()) return m[1].trim();
  const h1 = code.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1 && h1[1]?.trim()) return h1[1].trim().slice(0, 40);
  return "Aplicación web";
}

export function openArtifact(code: string, lang: string, customTitle?: string) {
  if (lang !== "html" && lang !== "svg") return;
  window.dispatchEvent(new CustomEvent<Artifact>(ARTIFACT_EVENT, {
    detail: { title: customTitle || extractArtifactTitle(code, lang), code, lang },
  }));
}

/** HTML scripts run only inside an opaque-origin sandbox; SVG is also sanitized. */
export function artifactDocument(artifact: Artifact): string {
  if (typeof window === "undefined") return "";
  if (artifact.lang === "svg") {
    const svg = DOMPurify.sanitize(artifact.code, { USE_PROFILES: { svg: true, svgFilters: true } });
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center}svg{max-width:100%;height:auto}</style></head><body>${svg}</body></html>`;
  }
  const doc = new DOMParser().parseFromString(artifact.code, "text/html");
  const hasTailwind = Array.from(doc.querySelectorAll("script[src],link[href]")).some((el) => /tailwind/i.test(el.getAttribute("src") ?? el.getAttribute("href") ?? "")) || /tailwindcss|@tailwind\b/i.test(Array.from(doc.querySelectorAll("style")).map((el) => el.textContent).join("\n"));
  if (!hasTailwind) {
    const script = doc.createElement("script");
    script.src = "https://cdn.tailwindcss.com";
    doc.head.append(script);
  }
  if (!doc.querySelector('meta[name="viewport"]')) {
    const viewport = doc.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width,initial-scale=1";
    doc.head.append(viewport);
  }
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

/** Never navigate a same-origin blob directly to model-authored JavaScript. */
export function artifactTabDocument(document: string): string {
  const escaped = document.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Vista previa · Erasmus</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head><body><iframe title="Vista previa del artefacto" sandbox="${ARTIFACT_SANDBOX}" srcdoc="${escaped}"></iframe></body></html>`;
}
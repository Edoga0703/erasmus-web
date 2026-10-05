import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { PURIFY_CONFIG } from "@/lib/markdown";

// Mermaid SVG: same FORBID rules, but keep the SVG <style>/<foreignObject> that carry labels.
const sanitizeSvg = (s: string) =>
  DOMPurify.sanitize(s, { ...PURIFY_CONFIG, USE_PROFILES: { svg: true, svgFilters: true, html: true }, ADD_TAGS: ["foreignObject", "style"], HTML_INTEGRATION_POINTS: { foreignobject: true } }) as string;

let seq = 0;
const theme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "default" : "dark");

/** Mermaid bundled via npm (no CDN); re-renders when <html data-theme> changes. */
export function Mermaid({ source }: { source: string }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    setMode(theme());
    const obs = new MutationObserver(() => setMode(theme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!mode) return;
    let alive = true;
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, theme: mode as "dark" | "default", securityLevel: "strict", htmlLabels: false, flowchart: { htmlLabels: false } });
        // Validate first: invalid syntax → plain code fallback, no throw, no stray error SVG in <body>.
        const valid = await mermaid.parse(source, { suppressErrors: true });
        if (!valid) { if (alive) setErr(true); return; }
        const id = `mmd-${++seq}`;
        let out = "";
        try {
          ({ svg: out } = await mermaid.render(id, source));
        } finally {
          document.getElementById(`d${id}`)?.remove(); // mermaid's temp container, if left behind
        }
        // Pipeline: model text → mermaid.render() → sanitizeSvg (DOMPurify, audited FORBID rules) → DOM.
        if (alive) { setSvg(sanitizeSvg(out)); setErr(false); }
      } catch {
        if (alive) setErr(true);
      }
    })();
    return () => { alive = false; };
  }, [source, mode]);

  if (err) return <pre data-mermaid-fallback="" className="rounded-md border border-e-line bg-e-bg p-3 text-[12px] text-e-dim">{source}</pre>;
  return <div data-mermaid-theme={mode ?? ""} className="my-3 flex justify-center overflow-x-auto rounded-lg border border-e-line bg-e-bg2 p-3 [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

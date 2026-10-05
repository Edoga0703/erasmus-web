import { useEffect, useState } from "react";
import { sanitize } from "@/lib/markdown";

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
        mermaid.initialize({ startOnLoad: false, theme: mode as "dark" | "default", securityLevel: "strict" });
        const { svg: out } = await mermaid.render(`mmd-${++seq}`, source);
        if (alive) { setSvg(sanitize(out)); setErr(false); }
      } catch {
        if (alive) setErr(true);
      }
    })();
    return () => { alive = false; };
  }, [source, mode]);

  if (err) return <pre className="rounded-md border border-e-line bg-e-bg p-3 text-[12px] text-e-dim">{source}</pre>;
  return <div className="my-3 flex justify-center overflow-x-auto rounded-lg border border-e-line bg-e-bg2 p-3 [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

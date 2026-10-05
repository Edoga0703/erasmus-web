import { useEffect, useMemo, useRef } from "react";
import { highlightWithin, renderMarkdown } from "@/lib/markdown";
import { splitRich } from "@/lib/charts";
import { Chart } from "./Chart";
import { Mermaid } from "./Mermaid";

function Html({ source, streaming }: { source: string; streaming?: boolean | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);
  useEffect(() => {
    if (!streaming && ref.current) highlightWithin(ref.current);
  }, [html, streaming]);
  return <div ref={ref} className="e-md" dangerouslySetInnerHTML={{ __html: html }} />;
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

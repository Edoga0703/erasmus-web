import { useEffect, useMemo, useRef } from "react";
import { highlightWithin, renderMarkdown } from "@/lib/markdown";

/** The ONLY place model Markdown becomes HTML: always marked + DOMPurify (reference rules). */
export function Markdown({ source, streaming }: { source: string; streaming?: boolean | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);
  useEffect(() => {
    if (!streaming && ref.current) highlightWithin(ref.current);
  }, [html, streaming]);
  return <div ref={ref} className="e-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

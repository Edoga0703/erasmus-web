/** Parser for ```chart blocks: "type: bar|line|share", "x: a, b, c", then one "Name: 1, 2, 3" line per series. */
export type ChartType = "bar" | "line" | "share";
export interface ChartSpec { type: ChartType; x: string[]; series: { name: string; values: number[] }[] }

export function parseChart(src: string): ChartSpec | null {
  let type: ChartType | null = null;
  let x: string[] = [];
  const series: ChartSpec["series"] = [];
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const i = line.indexOf(":");
    if (!line || i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (key.toLowerCase() === "type") {
      const v = val.toLowerCase();
      if (v === "bar" || v === "line" || v === "share") type = v;
    } else if (key.toLowerCase() === "x") {
      x = val.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      const values = val.split(",").map((s) => Number(s.trim().replace(/\s/g, "")));
      if (values.length && values.every((n) => Number.isFinite(n))) series.push({ name: key, values });
    }
  }
  if (!type || !series.length) return null;
  if (!x.length) x = series[0]!.values.map((_, i) => String(i + 1));
  return { type, x, series };
}

/** Theme colors via CSS variables (both themes). */
export const SERIES_COLORS = ["var(--acc2)", "var(--info)", "var(--ok)", "var(--err)", "var(--acc)", "var(--dim)"];

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

export type RichPart = { kind: "md"; text: string } | { kind: "chart"; text: string } | { kind: "mermaid"; text: string };

/** Split markdown into plain text and ```chart / ```mermaid fences (closed fences only). */
export function splitRich(md: string): RichPart[] {
  const re = /```(chart|mermaid)[^\n]*\n([\s\S]*?)\n?```/g;
  const out: RichPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m.index > last) out.push({ kind: "md", text: md.slice(last, m.index) });
    out.push({ kind: m[1] as "chart" | "mermaid", text: m[2] ?? "" });
    last = re.lastIndex;
  }
  if (last < md.length) out.push({ kind: "md", text: md.slice(last) });
  return out;
}

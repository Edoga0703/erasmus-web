/** Tool-block grammar (ANALYSIS.md §4). */
export type BlockKind = "code:python" | "code:bash" | "file:list" | "file:read" | "file:write" | "file:append";

export interface ToolBlock {
  kind: BlockKind;
  /** Path for file:* (arg line or body), first script line for code:*. */
  target: string;
  body: string;
  closed: boolean;
}

export type Segment = { type: "text"; text: string } | { type: "block"; index: number; block: ToolBlock };

const OPEN = /```(code:python|code:bash|file:list|file:read|file:write|file:append)([^\n]*)\n/gi;

function normalizeKind(k: string): BlockKind {
  return k.toLowerCase() as BlockKind;
}

/** Splits assistant content into text and tool-block segments (handles unclosed trailing block). */
export function parseSegments(content: string): Segment[] {
  const segs: Segment[] = [];
  let pos = 0;
  let idx = 0;
  OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN.exec(content)) !== null) {
    if (m.index > pos) segs.push({ type: "text", text: content.slice(pos, m.index) });
    const kind = normalizeKind(m[1] ?? "");
    const arg = (m[2] ?? "").trim();
    const start = m.index + m[0].length;
    const end = content.indexOf("```", start);
    const closed = end >= 0;
    const body = (closed ? content.slice(start, end) : content.slice(start)).replace(/\n$/, "");
    if (kind === "code:python" || kind === "code:bash") {
      // Unsupported execution blocks remain ordinary, visible Markdown code.
      segs.push({ type: "text", text: `\`\`\`${kind === "code:python" ? "python" : "bash"}\n${body}${closed ? "\n```" : ""}` });
      pos = closed ? end + 3 : content.length;
      OPEN.lastIndex = pos;
      continue;
    }
    const target = kind === "file:write" || kind === "file:append" ? arg : body.trim().split("\n")[0] ?? "";
    segs.push({ type: "block", index: idx++, block: { kind, target: kind.startsWith("code:") ? (body.trim().split("\n")[0] ?? "") : target, body, closed } });
    pos = closed ? end + 3 : content.length;
    OPEN.lastIndex = pos;
  }
  if (pos < content.length) segs.push({ type: "text", text: content.slice(pos) });
  return segs;
}

export function extractBlocks(content: string): ToolBlock[] {
  return parseSegments(content).flatMap((s) => (s.type === "block" ? [s.block] : []));
}

export interface DiffRow { kind: "add" | "del" | "same"; text: string }

/** Small LCS line diff for file:write previews. */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = before ? before.split("\n") : [];
  const b = after.split("\n");
  if (a.length * b.length > 250000) {
    return [...a.map((t) => ({ kind: "del" as const, text: t })), ...b.map((t) => ({ kind: "add" as const, text: t }))];
  }
  const n = a.length, k = b.length;
  const dp = new Int32Array((n + 1) * (k + 1));
  const at = (x: number, y: number) => dp[x * (k + 1) + y] ?? 0;
  for (let x = n - 1; x >= 0; x--)
    for (let y = k - 1; y >= 0; y--)
      dp[x * (k + 1) + y] = a[x] === b[y] ? at(x + 1, y + 1) + 1 : Math.max(at(x + 1, y), at(x, y + 1));
  const out: DiffRow[] = [];
  let x = 0, y = 0;
  while (x < n && y < k) {
    if (a[x] === b[y]) { out.push({ kind: "same", text: a[x] ?? "" }); x++; y++; }
    else if (at(x + 1, y) >= at(x, y + 1)) out.push({ kind: "del", text: a[x++] ?? "" });
    else out.push({ kind: "add", text: b[y++] ?? "" });
  }
  while (x < n) out.push({ kind: "del", text: a[x++] ?? "" });
  while (y < k) out.push({ kind: "add", text: b[y++] ?? "" });
  return out;
}

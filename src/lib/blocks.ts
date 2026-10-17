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

const OPEN = /(`{3,})(code:python|code:bash|file:list|file:read|file:write|file:append)([^\n]*)\n/gi;
const TOOL_TAG = /^(code:python|code:bash|file:list|file:read|file:write|file:append)\b/i;
const PATH_LINE_RE = /^(?:\.?[A-Za-z0-9_-]+(?:[\\/][A-Za-z0-9_.-]+)+|[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,10}|\.[A-Za-z0-9_-]+)$/;

function normalizeKind(k: string): BlockKind {
  return k.toLowerCase() as BlockKind;
}

/**
 * Finds the matching closing fence for a tool block starting at `start`.
 * Supports variable fence lengths (3+ backticks) and nested Markdown code fences
 * (e.g. ```js ... ``` inside a `file:write README.md` block) without premature truncation.
 */
function findClosingFence(
  content: string,
  start: number,
  fenceLen: number,
  allowNestedFences: boolean,
): { end: number; afterEnd: number } | null {
  let innerDepth = 0;
  let searchPos = start;

  while (searchPos < content.length) {
    const idx = content.indexOf("```", searchPos);
    if (idx < 0) return null;

    let tickCount = 3;
    while (idx + tickCount < content.length && content[idx + tickCount] === "`") {
      tickCount++;
    }

    const atLineStart = idx === start || content[idx - 1] === "\n";
    const lineEnd = content.indexOf("\n", idx + tickCount);
    const restOfLine = (lineEnd >= 0 ? content.slice(idx + tickCount, lineEnd) : content.slice(idx + tickCount)).trim();

    if (atLineStart) {
      // Another tool block opening while the previous block was never closed: treat previous as unclosed up to here.
      if (tickCount >= 3 && TOOL_TAG.test(restOfLine)) {
        return null;
      }
      if (restOfLine === "") {
        if (innerDepth > 0 && tickCount < fenceLen + 1) {
          innerDepth--;
          searchPos = lineEnd >= 0 ? lineEnd + 1 : content.length;
          continue;
        }
        if (tickCount >= fenceLen) {
          return { end: idx, afterEnd: idx + tickCount };
        }
      } else if (allowNestedFences && tickCount >= 3 && !TOOL_TAG.test(restOfLine)) {
        // Any info string opening a nested code block (e.g. ts, python title="x", json {1-5})
        innerDepth++;
        searchPos = lineEnd >= 0 ? lineEnd + 1 : content.length;
        continue;
      }
    } else if (innerDepth === 0 && tickCount >= fenceLen && restOfLine === "") {
      // Inline closing fence at the end of a single-line block (e.g. ```file:write a.txt\nHello```).
      return { end: idx, afterEnd: idx + tickCount };
    }

    searchPos = idx + tickCount;
  }

  return null;
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
    const fence = m[1] ?? "```";
    const kind = normalizeKind(m[2] ?? "");
    const arg = (m[3] ?? "").trim();
    const start = m.index + m[0].length;
    const allowNested = kind === "file:write" || kind === "file:append";
    const closeMatch = findClosingFence(content, start, fence.length, allowNested);
    const closed = closeMatch !== null;
    let body = (closeMatch ? content.slice(start, closeMatch.end) : content.slice(start)).replace(/\n$/, "");
    if (kind === "code:python" || kind === "code:bash") {
      // Unsupported execution blocks remain ordinary, visible Markdown code.
      segs.push({ type: "text", text: `${fence}${kind === "code:python" ? "python" : "bash"}\n${body}${closed ? `\n${fence}` : ""}` });
      pos = closeMatch ? closeMatch.afterEnd : content.length;
      OPEN.lastIndex = pos;
      continue;
    }
    let target = kind === "file:write" || kind === "file:append" ? arg : body.trim().split("\n")[0] ?? "";
    if ((kind === "file:write" || kind === "file:append") && !target && body.trim()) {
      const lines = body.split("\n");
      const firstLine = lines[0]?.trim() ?? "";
      if (lines.length > 1 && PATH_LINE_RE.test(firstLine)) {
        target = firstLine;
        body = lines.slice(1).join("\n").replace(/^\n+/, "");
      }
    }
    segs.push({ type: "block", index: idx++, block: { kind, target: kind.startsWith("code:") ? (body.trim().split("\n")[0] ?? "") : target, body, closed } });
    pos = closeMatch ? closeMatch.afterEnd : content.length;
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

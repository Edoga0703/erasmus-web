/**
 * Simulated Linux sandbox for mock mode. State persists in the shared in-memory
 * workspace (files written in one step can be read in the next).
 * Supports a credible subset: bash (ls, cat, echo [>|>>], pwd, mkdir, sleep, wc -l, head)
 * and basic Python (print of literals/arithmetic/file reads, open().write / Path.write_text
 * with triple-quoted strings, time.sleep, exceptions).
 */
export interface ExecResult { ok: boolean; exit_code: number; stdout: string; stderr: string; duration_ms: number }

const normPath = (p: string) => {
  const parts: string[] = [];
  for (const seg of p.replace(/\\/g, "/").split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
};
const resolve = (cwd: string, p: string) => normPath(p.startsWith("/") ? p : `${cwd}/${p}`);

function ls(files: Record<string, string>, dir: string): string[] | null {
  const prefix = dir ? dir + "/" : "";
  const names = new Set<string>();
  for (const k of Object.keys(files)) {
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const [head = "", ...tail] = rest.split("/");
    if (head) names.add(tail.length ? head + "/" : head);
  }
  if (!names.size && dir && !Object.keys(files).some((k) => k.startsWith(prefix))) return null;
  return [...names].sort();
}

function unquote(s: string): string | null {
  const m = s.trim().match(/^[fFrR]?(["'])([\s\S]*)\1$/);
  if (!m) return null;
  return (m[2] ?? "").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

export function runBash(files: Record<string, string>, code: string, cwd: string, timeout: number): ExecResult {
  let out = "";
  let err = "";
  let elapsed = 40;
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("set ")) continue;
    const [cmd = "", ...args] = line.split(/\s+/);
    const arg = args.join(" ");
    switch (cmd) {
      case "pwd": out += `/workspace/${cwd}\n`; break;
      case "mkdir": case "cd": case "true": break;
      case "ls": {
        const target = args.filter((a) => !a.startsWith("-"))[0] ?? ".";
        const r = ls(files, resolve(cwd, target));
        if (r === null) return { ok: false, exit_code: 2, stdout: out, stderr: err + `ls: no se puede acceder a '${target}': No existe el archivo o el directorio\n`, duration_ms: elapsed };
        out += r.join("\n") + (r.length ? "\n" : "");
        break;
      }
      case "cat": case "head": case "wc": {
        const target = args.filter((a) => !a.startsWith("-") && !/^\d+$/.test(a))[0] ?? "";
        const c = files[resolve(cwd, target)];
        if (c === undefined) return { ok: false, exit_code: 1, stdout: out, stderr: err + `${cmd}: ${target}: No existe el archivo o el directorio\n`, duration_ms: elapsed };
        if (cmd === "cat") out += c;
        else if (cmd === "wc") out += `${c.split("\n").filter(Boolean).length} ${target}\n`;
        else out += c.split("\n").slice(0, Number(args.find((a) => /^\d+$/.test(a)) ?? 10)).join("\n") + "\n";
        break;
      }
      case "echo": {
        const m = arg.match(/^(.*?)\s*(>>?)\s*(\S+)$/);
        const text = (unquote(m ? m[1] ?? "" : arg) ?? (m ? m[1] ?? "" : arg)) + "\n";
        if (m) {
          const key = resolve(cwd, m[3] ?? "");
          files[key] = m[2] === ">>" ? (files[key] ?? "") + text : text;
        } else out += text;
        break;
      }
      case "sleep": {
        const n = Number(args[0] ?? 0);
        if (n > timeout) return { ok: false, exit_code: 124, stdout: out, stderr: err + `Tiempo de ejecución agotado (${timeout} s)\n`, duration_ms: timeout * 1000 };
        elapsed += n * 1000;
        break;
      }
      default:
        return { ok: false, exit_code: 127, stdout: out, stderr: err + `bash: ${cmd}: orden no encontrada (sandbox simulado)\n`, duration_ms: elapsed };
    }
  }
  return { ok: true, exit_code: 0, stdout: out, stderr: err, duration_ms: elapsed };
}

export function runPython(files: Record<string, string>, code: string, cwd: string, timeout: number): ExecResult {
  let out = "";
  let elapsed = 180;
  const vars: Record<string, string> = {};

  // Multi-line file writes first.
  const writeRe = /(?:with\s+open\(\s*(["'])([^"']+)\1\s*,\s*(["'])([wa])\3[^)]*\)\s*as\s*(\w+)\s*:\s*\n\s*\5\.write\(|open\(\s*(["'])([^"']+)\6\s*,\s*(["'])([wa])\8[^)]*\)\.write\(|Path\(\s*(["'])([^"']+)\10\s*\)\.write_text\()\s*(?:[fr]?)("""|''')([\s\S]*?)\12\s*\)/g;
  let body = code.replace(writeRe, (_m, _q1, p1, _q2, mode1, _v, _q3, p2, _q4, mode2, _q5, p3, _q6, content) => {
    const path = p1 ?? p2 ?? p3;
    const mode = mode1 ?? mode2 ?? "w";
    const key = resolve(cwd, path);
    const text = String(content).replace(/^\n/, "");
    files[key] = mode === "a" ? (files[key] ?? "") + text : text;
    return "";
  });
  body = body.replace(/("""|''')[\s\S]*?\1/g, '""');

  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^(import|from)\s/.test(line)) continue;
    const sleep = line.match(/^time\.sleep\(\s*([\d.]+)\s*\)/);
    if (sleep) {
      const n = Number(sleep[1]);
      if (n > timeout) return { ok: false, exit_code: 124, stdout: out, stderr: `Tiempo de ejecución agotado (${timeout} s)\n`, duration_ms: timeout * 1000 };
      elapsed += n * 1000;
      continue;
    }
    if (/^raise\s/.test(line) || /\b1\s*\/\s*0\b/.test(line)) {
      const exc = line.match(/^raise\s+(\w+)\((.*)\)/);
      return { ok: false, exit_code: 1, stdout: out, stderr: `Traceback (most recent call last):\n  File "<sandbox>", line 1, in <module>\n${exc ? `${exc[1]}: ${unquote(exc[2] ?? "") ?? exc[2]}` : "ZeroDivisionError: division by zero"}\n`, duration_ms: elapsed };
    }
    const assign = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (assign && !line.startsWith("print")) {
      const v = unquote(assign[2] ?? "");
      if (v !== null) vars[assign[1] ?? ""] = v;
      continue;
    }
    const pr = line.match(/^print\((.*)\)\s*$/);
    if (pr) {
      const expr = (pr[1] ?? "").trim();
      const readM = expr.match(/^open\(\s*(["'])([^"']+)\1\s*\)\.read\(\)$/);
      if (readM) {
        const c = files[resolve(cwd, readM[2] ?? "")];
        if (c === undefined) return { ok: false, exit_code: 1, stdout: out, stderr: `FileNotFoundError: [Errno 2] No such file or directory: '${readM[2]}'\n`, duration_ms: elapsed };
        out += c + "\n";
        continue;
      }
      const lit = unquote(expr);
      if (lit !== null) { out += lit.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m) + "\n"; continue; }
      if (vars[expr] !== undefined) { out += vars[expr] + "\n"; continue; }
      if (/^[\d\s+\-*/().%]+$/.test(expr)) {
        try { out += String(Function(`"use strict";return (${expr})`)()) + "\n"; } catch { out += expr + "\n"; }
        continue;
      }
      out += expr + "\n";
    }
  }
  return { ok: true, exit_code: 0, stdout: out, stderr: "", duration_ms: elapsed };
}

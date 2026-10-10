/** Client-side text extraction for PDF and spreadsheet attachments (libraries load on demand). */
export const MAX_DOC_CHARS = 150_000;

export function capText(t: string): string {
  return t.length > MAX_DOC_CHARS ? t.slice(0, MAX_DOC_CHARS) + "\n[...documento truncado]" : t;
}

export async function extractPdf(f: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  let out = `[Documento PDF: ${f.name} (${doc.numPages} páginas)]`;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("").trim();
    out += `\n--- Página ${i} ---\n${text}`;
    if (out.length > MAX_DOC_CHARS) break;
  }
  return capText(out);
}

export async function extractSheet(f: File): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  let out = `[Hoja de cálculo: ${f.name}]`;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    out += `\n### Hoja: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`;
    if (out.length > MAX_DOC_CHARS) break;
  }
  return capText(out);
}

const ZIP_TEXT_EXT = /\.(txt|md|markdown|json|csv|tsv|html|htm|css|scss|less|js|jsx|ts|tsx|mjs|cjs|py|java|c|cpp|h|hpp|cs|go|rs|php|rb|sh|bat|ps1|sql|yaml|yml|xml|env|ini|toml|cfg|conf|log|tex|svg|vue|svelte|astro|graphql|gql|prisma|proto)$/i;

function fmtSize(n: number): string {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

/** Lists a ZIP's central directory and inlines text entries (stored or deflate via DecompressionStream). */
export async function extractZip(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const dec = new TextDecoder();
  // Locate End Of Central Directory record (0x06054b50) scanning backwards.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return `[Archivo ZIP: ${f.name}]\nNo se pudo leer el contenido del ZIP.`;
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries: { name: string; method: number; csize: number; usize: number; local: number }[] = [];
  for (let k = 0; k < count && p + 46 <= bytes.length; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const usize = view.getUint32(p + 24, true);
    const nlen = view.getUint16(p + 28, true);
    const elen = view.getUint16(p + 30, true);
    const clen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    entries.push({ name, method, csize, usize, local });
    p += 46 + nlen + elen + clen;
  }
  const files = entries.filter((e) => !e.name.endsWith("/"));
  let out = `[Archivo ZIP: ${f.name} (${files.length} archivos)]\n### Contenido\n` + files.map((e) => `- ${e.name} (${fmtSize(e.usize)})`).join("\n");
  const canInflate = typeof DecompressionStream !== "undefined";
  for (const e of files) {
    if (out.length > MAX_DOC_CHARS) break;
    if (!ZIP_TEXT_EXT.test(e.name) || (e.method !== 0 && !(e.method === 8 && canInflate))) continue;
    try {
      if (view.getUint32(e.local, true) !== 0x04034b50) continue;
      const start = e.local + 30 + view.getUint16(e.local + 26, true) + view.getUint16(e.local + 28, true);
      const raw = bytes.slice(start, start + e.csize);
      const data = e.method === 0
        ? raw.buffer
        : await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
      out += `\n\n--- ${e.name} ---\n${dec.decode(data)}`;
    } catch { /* skip entries that fail to decompress */ }
  }
  return capText(out);
}

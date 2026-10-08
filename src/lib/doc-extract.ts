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

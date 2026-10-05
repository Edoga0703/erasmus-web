import type { ChatData } from "@/lib/api/types";

/** In-memory workspace used by mock mode. Paths are relative to the workspace root. */
export function seedFiles(): Record<string, string> {
  return {
    "README.md": "# Proyecto de demostración\n\nWorkspace simulado de Erasmus Web.\n",
    "src/main.py": 'def saludo(nombre: str) -> str:\n    return f"Hola, {nombre}"\n\nif __name__ == "__main__":\n    print(saludo("Erasmus"))\n',
    "src/utils.ts": "export const suma = (a: number, b: number) => a + b;\n",
    "notas/reunion.txt": "Reunión lunes 10:00\n- Revisar presupuesto Q4\n- Preparar propuesta cliente\n",
    "artifacts/informe.html":
      '<!doctype html><html><body style="font-family:sans-serif;padding:24px"><h1>Informe trimestral</h1><p>Ventas +12% respecto al trimestre anterior.</p></body></html>',
    "docs/factura.pdf": "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 165 >>\nstream\nBT /F1 22 Tf 40 230 Td (Factura de ejemplo) Tj ET\nBT /F1 12 Tf 40 200 Td (Erasmus Web - PDF de demostracion) Tj ET\nBT /F1 12 Tf 40 180 Td (Total: 1.250,00 EUR) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000457 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n527\n%%EOF\n", // C1: static minimal PDF (~0.7 KB)
    "sandbox/demo-1/presupuesto.csv": "partida,previsto,real\npersonal,50000,48500\nmarketing,12000,10900\n",
    "artifacts/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#3b82f6"/><text x="60" y="76" font-size="48" text-anchor="middle" fill="#fff" font-family="sans-serif">E</text></svg>',
    "artifacts/resumen.md": "# Resumen ejecutivo\n\n- Crecimiento sostenido\n- Nuevos mercados\n",
  };
}

export function seedChats(): Record<string, ChatData> {
  const now = Date.now();
  return {
    "demo-1": {
      id: "demo-1",
      title: "Análisis del presupuesto Q4",
      created: now - 86400000 * 2,
      updated: now - 86400000,
      // Saved exactly as the client persists a turn with tools (assistant.tools + hidden results).
      messages: [
        { role: "user", text: "¿Cómo va el presupuesto del Q4?", ts: now - 86400000 * 2 },
        {
          role: "assistant",
          c: "Reviso los datos del sandbox.\n\n```code:bash\nls\ncat presupuesto.csv\n```\n\n```code:python\nprint(48500+10900)\nprint(50000+12000)\n```\n",
          ts: now - 86400000 * 2,
          tools: {
            0: { status: "ok", exitCode: 0, durationMs: 420, stdout: "presupuesto.csv\npartida,previsto,real\npersonal,50000,48500\nmarketing,12000,10900", stderr: "" },
            1: { status: "ok", exitCode: 0, durationMs: 530, stdout: "59400\n62000", stderr: "" },
          },
        },
        { role: "user", hidden: true, text: "[RESULTADOS DE HERRAMIENTAS]\n[RESULTADO code:bash (exit 0, 0.4s)]\npresupuesto.csv\n...\n\n[RESULTADO code:python (exit 0, 0.5s)]\n59400\n62000", ts: now - 86400000 * 2 },
        {
          role: "assistant",
          c: "El presupuesto del Q4 va **un 4% por debajo** de lo previsto (59 400 € frente a 62 000 €).\n\n```chart\ntype: share\nx: personal, marketing\nReal: 48500, 10900\nAhorro: 1500, 1100\n```\n\nDejo una nota guardada:\n\n```file:write notas/q4.txt\nQ4: 4% por debajo del presupuesto.\n```\n",
          ts: now - 86400000 * 2,
          tools: { 0: { status: "ok", detail: "34 bytes escritos", diff: [{ kind: "add", text: "Q4: 4% por debajo del presupuesto." }] } },
        },
      ],
    },
    // H6 perf fixture: ~200 messages to check scroll stability.
    "demo-long": {
      id: "demo-long",
      title: "Prueba de rendimiento (200 mensajes)",
      created: now - 86400000 * 7,
      updated: now - 86400000 * 7,
      messages: Array.from({ length: 200 }, (_, i) =>
        i % 2 === 0
          ? { role: "user" as const, text: `Pregunta ${i / 2 + 1}: ¿cómo va el indicador ${i / 2 + 1}?`, ts: now - 86400000 * 7 + i * 1000 }
          : { role: "assistant" as const, c: `Respuesta ${(i + 1) / 2}: el indicador sube un **${i % 7}%**.\n\n- Punto A\n- Punto B\n\n\`\`\`python\nprint(${i})\n\`\`\`\n`, ts: now - 86400000 * 7 + i * 1000 },
      ),
    },
    "demo-2": {
      id: "demo-2",
      title: "Propuesta para cliente",
      created: now - 3600000 * 5,
      updated: now - 3600000 * 3,
      messages: [
        { role: "user", text: "Redacta una propuesta breve.", ts: now - 3600000 * 5 },
        { role: "assistant", c: "Aquí tienes un borrador de propuesta…", ts: now - 3600000 * 5 },
      ],
    },
  };
}

/** Scripted assistant replies keyed by the user's first prompt and the number of tool round-trips. */
export function scriptedReply(prompt: string, step: number): string {
  if (/^\s*(hola|buenas)/i.test(prompt)) {
    return "¡Hola! Soy **Erasmus**. Trabajo en un sandbox Linux: puedo ejecutar Python y bash, leer y escribir archivos y entregarte resultados. Prueba con *\"analiza estos datos, hazme un gráfico de barras y guárdame el CSV\"*.";
  }
  if (step === 0) {
    return [
      "Voy a preparar los datos en el sandbox.\n\n",
      "```code:bash\npwd\nls\n```\n\n",
      "```code:python\nimport csv\nwith open(\"ventas.csv\", \"w\") as f:\n    f.write(\"\"\"mes,norte,sur\nene,120,90\nfeb,135,110\nmar,150,128\nabr,142,140\n\"\"\")\nprint(\"CSV guardado: 4 filas\")\nprint(120+135+150+142)\n```\n\n",
      "```code:bash\ncat ventas.csv\nwc -l ventas.csv\n```\n",
    ].join("");
  }
  if (step === 1) {
    return [
      "Datos listos. Las ventas del **norte** suman **547** y crecen hasta marzo; el **sur** sube de forma constante.\n\n",
      "```chart\ntype: bar\nx: ene, feb, mar, abr\nNorte: 120, 135, 150, 142\nSur: 90, 110, 128, 140\n```\n\n",
      "Así fluye el proceso:\n\n```mermaid\nflowchart LR\n  A[ventas.csv] --> B[Python: análisis]\n  B --> C[Gráfico]\n  B --> D[Resumen]\n```\n\n",
      "| Mes | Norte | Sur |\n|---|---|---|\n| ene | 120 | 90 |\n| feb | 135 | 110 |\n| mar | 150 | 128 |\n| abr | 142 | 140 |\n\n",
      "El archivo `ventas.csv` está en tu sandbox. Guardo también un informe visual:\n\n",
      "```file:write artifacts/ventas.html\n<!doctype html><html><body style=\"font-family:sans-serif;padding:24px\"><h1>Ventas ene–abr</h1><p>Norte: <b>547</b> · Sur: <b>468</b></p><script>document.body.insertAdjacentHTML('beforeend','<p>Generado ' + new Date().toLocaleDateString() + '</p>')</script></body></html>\n```\n",
    ].join("");
  }
  if (step === 2) {
    // V2 fixture: invalid mermaid on purpose → must fall back to plain code.
    return "Listo: el informe está en **artifacts/ventas.html** (ábrelo en el panel de archivos).\n\nBorrador de diagrama (incompleto):\n\n```mermaid\ngraph TD\n A -->\n```\n";
  }
  return "Listo.";
}

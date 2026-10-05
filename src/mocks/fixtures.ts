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
      messages: [
        { role: "user", text: "¿Cómo va el presupuesto del Q4?", ts: now - 86400000 * 2 },
        { role: "assistant", c: "El presupuesto del Q4 va **un 4% por debajo** de lo previsto.", ts: now - 86400000 * 2 },
      ],
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

/** Scripted assistant replies. First turn uses tool blocks; follow-ups summarise. */
export function scriptedReply(lastUser: string, isFollowup: boolean): string {
  if (isFollowup) {
    return [
      "He revisado el workspace y he guardado las notas.\n\n",
      "**Resumen:**\n\n- `src/` contiene el código principal.\n- He creado `notas/resumen.md` con los puntos clave.\n\n",
      "El comando de PowerShell no se puede ejecutar en la versión web.",
    ].join("");
  }
  if (/hola|buenas/i.test(lastUser)) {
    return "¡Hola! Soy **Erasmus**. Puedo leer y escribir archivos de tu workspace. Pídeme, por ejemplo, *\"revisa el proyecto y crea un resumen\"*.";
  }
  return [
    "Voy a revisar el workspace primero.\n\n",
    "```file:list\n.\n```\n\n",
    "Leo el archivo principal:\n\n",
    "```file:read\nsrc/main.py\n```\n\n",
    "Guardo un resumen:\n\n",
    "```file:write notas/resumen.md\n# Resumen\n\n- Proyecto Python con utilidades TS\n- Pendiente: presupuesto Q4\n```\n\n",
    "Y compruebo la versión de Python:\n\n",
    "```powershell:run\npython --version\n```\n",
  ].join("");
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiJson, streamChat } from "@/lib/api/client";

/** Regla: 503 es mantenimiento temporal del motor; se muestra el mensaje del servidor (p. ej. "Ajuste rápido") y nunca expulsa la sesión. */
describe("manejo de 503", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("muestra el mensaje del servidor cuando lo envía", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "maintenance", message: "Ajuste rápido" } }), { status: 503, headers: { "Content-Type": "application/json" } })));
    const err = await apiJson("/health").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect((err as ApiError).message).toBe("Ajuste rápido");
  });

  it("usa el mensaje por defecto cuando el servidor no explica", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const err = await apiJson("/health").catch((e) => e);
    expect((err as ApiError).status).toBe(503);
    expect((err as ApiError).message).toBe("El motor de inferencia está en ajuste temporal. Vuelve a intentarlo en unos minutos.");
  });
});

describe("mensajes públicos de errores", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [402, "Has alcanzado el límite de imágenes de tu plan."],
    [429, "Procesos en cola: esperando a desocuparse un cupo para continuar."],
  ])("simplifica el error %s sin filtrar detalles internos", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "internal_limit", message: "Internal details" } }), { status })));
    await expect(apiJson("/health")).rejects.toMatchObject({ status, message });
  });

  it("explica las herramientas no disponibles sin realizar peticiones", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(api.fsWrite("note.txt", "text", true)).rejects.toMatchObject({ message: "Añadir a un archivo no está disponible en este momento." });
    await expect(api.exec({} as Parameters<typeof api.exec>[0])).rejects.toMatchObject({ message: "La ejecución de código no está disponible." });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("procesa el último evento SSE aunque el stream cierre sin salto de línea ni [DONE]", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning":"Pensando paso 1"}}]}\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hola mundo"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}'));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    let tokens = "";
    let reasoning = "";
    let finish = "";
    let total = 0;
    await streamChat({
      model: "erasmus-v2",
      messages: [{ role: "user", content: "Hola" }],
      onToken: (t) => { tokens += t; },
      onReasoning: (r) => { reasoning += r; },
      onMeta: (m) => { if (m.finishReason) finish = m.finishReason; if (m.usage) total = m.usage.total; },
    });
    expect(tokens).toBe("Hola mundo");
    expect(reasoning).toBe("Pensando paso 1");
    expect(finish).toBe("stop");
    expect(total).toBe(6);
  });

  it("reconoce reasoning emitido como delta.thinking o delta.thought", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"thinking":"Pensamiento en thinking"}}]}\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"thought":" y thought"}}]}\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Respuesta final"}}]}\n'));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    let reasoning = "";
    let content = "";
    await streamChat({
      model: "erasmus-v2",
      messages: [{ role: "user", content: "Hola" }],
      onToken: (t) => { content += t; },
      onReasoning: (r) => { reasoning += r; },
    });
    expect(reasoning).toBe("Pensamiento en thinking y thought");
    expect(content).toBe("Respuesta final");
  });
});

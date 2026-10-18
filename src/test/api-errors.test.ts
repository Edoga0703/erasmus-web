import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiJson, normalizeTs, publicStatus, streamChat, withSystem } from "@/lib/api/client";
import { getModelConfig, normalizeReasoningEffort, REASONING_EFFORTS, saveModelConfig } from "@/lib/api/config";
import { runBlock, withAttachments } from "@/hooks/use-chat";
import { uniqueWorkspacePath } from "@/components/shell/AppShell";
import { claimCoupon } from "@/lib/auth";
import { clearSession, getSession } from "@/lib/session";
import { formatPlanExpiry, formatPlanName } from "@/components/shell/UsageMeter";

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

/** Reglas de robustez de red de la auditoría. */
describe("robustez de red", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("aplica el tiempo límite aunque el llamador pase su propia señal", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_r, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const err = await apiJson("/x", undefined, "GET", new AbortController().signal, 20).catch((e) => e);
    expect((err as ApiError).status).toBe(408);
  });

  it("un stream que se corta sin [DONE] ni finish_reason es un error reintentable", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hola"}}]}\n')); c.close(); } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    const err = await streamChat({ model: "erasmus-v2", messages: [{ role: "user", content: "Hola" }], onToken: () => {} }).catch((e) => e);
    expect((err as ApiError).code).toBe("stream_incomplete");
  });

  it("detener manualmente el stream con AbortSignal no lanza stream_incomplete", async () => {
    const ctrl = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Parcial"}}]}\n'));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    let out = "";
    await expect(
      streamChat({
        model: "erasmus-v2",
        messages: [{ role: "user", content: "Hola" }],
        signal: ctrl.signal,
        onToken: (t) => {
          out += t;
          ctrl.abort();
        },
      }),
    ).resolves.toBeUndefined();
    expect(out).toBe("Parcial");
  });

  it("permite cerrar sin finish_reason cuando requireFinish es false y hubo salida (compactación)", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Resumen válido"}}]}\n'));
        c.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    let summary = "";
    await expect(
      streamChat({
        model: "erasmus-v2",
        messages: [{ role: "user", content: "Resume" }],
        requireFinish: false,
        onToken: (t) => { summary += t; },
      }),
    ).resolves.toBeUndefined();
    expect(summary).toBe("Resumen válido");
  });

  it("propaga AbortSignal desde runBlock hacia las lecturas/escrituras del workspace", async () => {
    const ctrl = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_r, reject) => {
      init.signal?.addEventListener("abort", () => {
        ctrl.abort();
        reject(new DOMException("aborted", "AbortError"));
      });
      setTimeout(() => ctrl.abort(), 10);
    })));
    const res = await runBlock({ kind: "file:read", target: "notas.txt", body: "", closed: true }, "c1", ctrl.signal);
    expect(res.state.status).toBe("error");
    expect(res.state.detail).toBe("Cancelado.");
    expect(res.feedback).toBeNull();
  });
});

describe("mensajes públicos de errores y contratos", () => {
  afterEach(() => { vi.unstubAllGlobals(); clearSession(); localStorage.clear(); });

  it.each([
    [402, "Has alcanzado el límite de imágenes de tu plan."],
    [429, "Procesos en cola: esperando a desocuparse un cupo para continuar."],
  ])("simplifica el error %s sin filtrar detalles internos", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "internal_limit", message: "Internal details" } }), { status })));
    await expect(apiJson("/health")).rejects.toMatchObject({ status, message });
  });

  it("diferencia 402 por agotamiento de tokens del límite de imágenes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "token_quota_exceeded", message: "Out of tokens" } }), { status: 402 })));
    await expect(apiJson("/health")).rejects.toMatchObject({ status: 402, message: "Has agotado el saldo de tokens de tu plan." });
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
        controller.enqueue(encoder.encode("data: [DONE]\n"));
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

  it("normaliza timestamps en ms, segundos e ISO-8601 y valida reasoning_effort", () => {
    expect(normalizeTs(1760000000)).toBe(1760000000000);
    expect(normalizeTs(1760000000000)).toBe(1760000000000);
    expect(normalizeTs("2026-10-16T00:00:00.000Z")).toBe(Date.parse("2026-10-16T00:00:00.000Z"));
    expect(normalizeTs("invalido", 42)).toBe(42);
    expect(normalizeReasoningEffort("high")).toBe("high");
    expect(normalizeReasoningEffort("ultra")).toBe("medium");
    expect(getModelConfig().reasoning).toBe("medium");
    expect(REASONING_EFFORTS.map((r) => r.id)).toEqual(["none", "low", "medium", "high"]);
    saveModelConfig({ model: "erasmus-v2", reasoning: "high" });
    expect(getModelConfig().reasoning).toBe("high");
  });

  it("acepta variantes saludables en publicStatus y deduplica rutas de adjuntos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })));
    await expect(publicStatus()).resolves.toEqual({ available: true });

    const taken = new Set<string>();
    expect(uniqueWorkspacePath("c1", "notas.txt", taken)).toBe("conversations/c1/notas.txt");
    expect(uniqueWorkspacePath("c1", "notas.txt", taken)).toBe("conversations/c1/notas-2.txt");
    expect(uniqueWorkspacePath("c1", "notas.txt", taken)).toBe("conversations/c1/notas-3.txt");
  });

  it("recorta adjuntos para el modelo según FILE_MAX_FRACTION sin mutar el mensaje original", () => {
    const bigText = "A".repeat(10_000);
    const msg = {
      id: "m1",
      role: "user" as const,
      content: "Analiza esto",
      ts: Date.now(),
      attachments: [{ name: "informe.pdf", size: 10000, path: "conversations/c1/informe.pdf", text: bigText }],
    };
    const modelPrompt = withAttachments(msg, 2_000); // 2000 tokens * 0.5 * 4 = 4000 chars max
    expect(modelPrompt).toContain("recortado para el modelo; el archivo completo sigue en conversations/c1/informe.pdf");
    expect(msg.attachments[0]?.text).toHaveLength(10_000);
  });

  it("unifica el system prompt del cliente con el resumen de compactación sin duplicar bloques system", () => {
    const merged = withSystem([
      { role: "system", content: "[RESUMEN DE LA CONVERSACIÓN ANTERIOR]\nContexto previo" },
      { role: "user", content: "Hola" },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.role).toBe("system");
    expect(String(merged[0]?.content)).toContain("file:list, file:read y file:write");
    expect(String(merged[0]?.content)).toContain("[RESUMEN DE LA CONVERSACIÓN ANTERIOR]\nContexto previo");
    expect(merged[1]?.role).toBe("user");
  });

  it("canjea cupón de nuevo usuario (claim_new) e inicia sesión automáticamente incluso si solo devuelve code", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/api/coupons/claim_new")) {
        return new Response(JSON.stringify({ ok: true, code: "erm-1234-5678-90123-4567", plan: "pro", expires_at: "2026-11-18T00:00:00.000Z" }), { status: 200 });
      }
      if (url.endsWith("/api/auth/login")) {
        return new Response(JSON.stringify({ ok: true, session: "sess_abc", user_id: "usr_1", plan: "pro", expires: "2026-11-18T00:00:00.000Z" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await claimCoupon("erm-promo-2026");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.claim.accessCode).toBe("erm-1234-5678-90123-4567");
      expect(res.claim.plan).toBe("pro");
    }
    expect(getSession()?.token).toBe("sess_abc");
  });

  it("formatea nombres de plan y fechas de vencimiento (expires_at)", () => {
    expect(formatPlanName("pro")).toBe("Pro");
    expect(formatPlanName("enterprise")).toBe("Enterprise");
    const soon = formatPlanExpiry(Date.now() + 2 * 86_400_000);
    expect(soon?.urgent).toBe(true);
    expect(soon?.expired).toBe(false);
    const expired = formatPlanExpiry(Date.now() - 10_000);
    expect(expired?.expired).toBe(true);
    expect(expired?.label).toBe("Vencido");
  });
});

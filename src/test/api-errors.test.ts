import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiJson } from "@/lib/api/client";

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
});

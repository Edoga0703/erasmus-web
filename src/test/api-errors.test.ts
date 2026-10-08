import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiJson } from "@/lib/api/client";

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

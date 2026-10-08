import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api/client";
import { API_BASE } from "@/lib/api/config";
import { renderMarkdown } from "@/lib/markdown";
import { Markdown } from "@/components/chat/Markdown";
import { Composer } from "@/components/chat/Composer";
import { collectImages } from "@/components/chat/Images";
import { FilesPanel } from "@/components/files/FilesPanel";
import { useChat } from "@/hooks/use-chat";
import { clearSession, getSession, setSession } from "@/lib/session";
import { IMAGE_VIEW_EVENT } from "@/lib/images";

afterEach(() => { cleanup(); clearSession(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Markdown enriquecido", () => {
  it.each([["NOTE", "Nota"], ["TIP", "Consejo"], ["IMPORTANT", "Importante"], ["WARNING", "Advertencia"], ["CAUTION", "Precaución"]])("renderiza %s sin perder contenido", (type, label) => {
    const root = document.createElement("div");
    root.innerHTML = renderMarkdown(`> [!${type}]\n> **Resumen**\n> Detalle\n>\n> - Uno\n> - Dos`);
    expect(root.querySelector(`[role=note].e-callout-${type?.toLowerCase()}`)).toBeTruthy();
    expect(root.querySelector(".e-callout-head")?.textContent).toBe(label);
    expect(root.querySelector("strong")?.textContent).toBe("Resumen");
    expect(root.querySelectorAll("li")).toHaveLength(2);
    expect(root.textContent).not.toContain(`[!${type}]`);
  });
  it("conserva citas y tablas; elimina scripts y manejadores", () => {
    const html = renderMarkdown('> Cita normal\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> [!NOTE]\n> <img src="https://example.com/a.png" onerror="alert(1)"><script>alert(2)</script>');
    expect(html).toContain("<blockquote>"); expect(html).toContain("<table>");
    expect(html).not.toContain("onerror"); expect(html).not.toContain("<script");
  });
  it("emite el evento del visor al pulsar una imagen", () => {
    const listener = vi.fn(); window.addEventListener(IMAGE_VIEW_EVENT, listener);
    render(<Markdown source="![Paisaje](/api/images/landscape.png)" />);
    fireEvent.click(screen.getByRole("img"));
    expect(listener.mock.calls[0]?.[0].detail).toMatchObject({ alt: "Paisaje", fromUser: false });
    window.removeEventListener(IMAGE_VIEW_EVENT, listener);
  });
});

describe("Generación nativa", () => {
  it("envía el contrato exacto con sesión y conserva errores de cuota", async () => {
    setSession({ token: "unit-session", userId: "unit", plan: "pro", expires: Date.now() + 60000 });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ created: 1, data: [{ url: "/api/images/a.png" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "weekly_allowance_reached", message: "Sin cuota" } }), { status: 402 }));
    vi.stubGlobal("fetch", fetcher);
    await api.generateImage("Un bosque", "1792x1024");
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(`${API_BASE}/v1/images/generations`);
    expect(init.method).toBe("POST"); expect(init.headers.get("X-Erasmus-Session")).toBe("unit-session");
    expect(JSON.parse(init.body)).toEqual({ prompt: "Un bosque", size: "1792x1024", n: 1 });
    await expect(api.generateImage("Otro")).rejects.toMatchObject({ code: "weekly_allowance_reached", status: 402 });
    expect(getSession()?.userId).toBe("unit");
  });
  it.each(["/imagen Un bosque", "/image Un bosque"])("interpreta %s y rechaza comandos vacíos", (command) => {
    const generate = vi.fn(); const send = vi.fn();
    render(<Composer busy={false} onSend={send} onStop={() => {}} onGenerateImage={generate} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "/imagen" } });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    fireEvent.change(input, { target: { value: command } }); fireEvent.keyDown(input, { key: "Enter" });
    expect(generate).toHaveBeenCalledWith("Un bosque", "1024x1024"); expect(send).not.toHaveBeenCalled();
  });
  it("persiste la imagen y la incluye en las galerías", async () => {
    vi.spyOn(api, "generateImage").mockResolvedValue({ created: 1, data: [{ url: "/api/images/forest.png" }] });
    const sync = vi.spyOn(api, "syncChat").mockResolvedValue({ ok: true, id: "test" });
    vi.spyOn(api, "files").mockResolvedValue({ ok: true, workspace_name: "Test", files: [] });
    const { result } = renderHook(() => useChat({ model: "erasmus-v2" }));
    await act(() => result.current.generateImage("Bosque [verde]", "1024x1024"));
    expect(result.current.busy).toBe(false); expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.content).toContain("[!TIP]");
    expect(sync).toHaveBeenCalled();
    expect(collectImages(result.current.messages)).toHaveLength(1);
    render(<FilesPanel convId={result.current.chatId} refreshKey={0} messages={result.current.messages} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("forest.png")).toBeTruthy());
  });
  it("reintenta imágenes, no chat; cuota no permite reintentar", async () => {
    const generate = vi.spyOn(api, "generateImage").mockRejectedValueOnce(new ApiError(503, "maintenance", "Ajuste rápido"))
      .mockResolvedValueOnce({ created: 1, data: [{ url: "/api/images/a.png" }] })
      .mockRejectedValueOnce(new ApiError(402, "weekly_allowance_reached", "Cupo agotado"));
    vi.spyOn(api, "syncChat").mockResolvedValue({ ok: true, id: "test" });
    const { result } = renderHook(() => useChat({ model: "erasmus-v2" }));
    await act(() => result.current.generateImage("Bosque", "1024x1024"));
    expect(result.current.messages[1]?.error?.message).toBe("Ajuste rápido");
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(generate).toHaveBeenCalledTimes(2); expect(result.current.messages).toHaveLength(2);
    await act(() => result.current.generateImage("Mar", "1024x1024"));
    expect(result.current.messages[3]?.error?.retryable).toBe(false);
    act(() => result.current.retry()); expect(generate).toHaveBeenCalledTimes(3);
  });
  it("ignora respuestas tardías después de iniciar otro chat", async () => {
    let resolve: ((value: { created: number; data: { url: string }[] }) => void) | undefined;
    vi.spyOn(api, "generateImage").mockImplementation(() => new Promise((r) => { resolve = r; }));
    const sync = vi.spyOn(api, "syncChat").mockResolvedValue({ ok: true, id: "test" });
    const { result } = renderHook(() => useChat({ model: "erasmus-v2" }));
    let pending: Promise<void> | undefined;
    act(() => { pending = result.current.generateImage("Bosque", "1024x1024"); });
    act(() => result.current.reset());
    await act(async () => { resolve?.({ created: 1, data: [{ url: "/api/images/a.png" }] }); await pending; });
    expect(result.current.messages).toHaveLength(0); expect(sync).not.toHaveBeenCalled();
  });
  it("no guarda conversaciones temporales", async () => {
    vi.spyOn(api, "generateImage").mockResolvedValue({ created: 1, data: [{ url: "/api/images/a.png" }] });
    const sync = vi.spyOn(api, "syncChat").mockResolvedValue({ ok: true, id: "test" });
    const { result } = renderHook(() => useChat({ model: "erasmus-v2" }));
    act(() => result.current.startTemporary());
    await act(() => result.current.generateImage("Bosque", "1024x1024"));
    expect(sync).not.toHaveBeenCalled();
  });
});
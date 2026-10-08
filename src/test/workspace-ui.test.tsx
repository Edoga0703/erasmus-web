import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { AppSplash } from "@/components/shell/AppSplash";
import { findSearchRanges, InChatSearch } from "@/components/chat/InChatSearch";
import { FilesPanel, fileCategory } from "@/components/files/FilesPanel";
import { api } from "@/lib/api/client";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Workspace UI", () => {
  it("waits for readiness and fades the splash out", async () => {
    const { rerender } = render(<AppSplash ready={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Iniciando espacio de trabajo");
    rerender(<AppSplash ready />);
    expect(screen.getByRole("status")).toHaveClass("opacity-0");
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
  it("finds formatted text without changing DOM or counting controls", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-search-text>Hola mundo</div><div class="e-md">Hola <strong>mundo</strong><button>Hola mundo</button><div hidden>Hola mundo</div></div>';
    const before = root.innerHTML;
    const ranges = findSearchRanges(root, "hola mundo");
    expect(ranges).toHaveLength(2);
    expect(ranges[1]?.toString()).toBe("Hola mundo");
    expect(root.innerHTML).toBe(before);
  });
  it("navigates with Enter and Shift+Enter and closes with Escape", async () => {
    const rootRef = createRef<HTMLElement>();
    const root = document.createElement("section"); root.innerHTML = '<p data-search-text>Hola Hola</p>';
    Object.assign(rootRef, { current: root });
    const onClose = vi.fn();
    render(<InChatSearch rootRef={rootRef} onClose={onClose} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "hola" } });
    await waitFor(() => expect(screen.getByText("1 de 2")).toBeTruthy());
    fireEvent.keyDown(input, { key: "Enter" }); expect(screen.getByText("2 de 2")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true }); expect(screen.getByText("1 de 2")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" }); expect(onClose).toHaveBeenCalledOnce();
  });
  it("shows scoped gallery, type filters and opens artifacts", async () => {
    vi.spyOn(api, "files").mockResolvedValue({ ok: true, workspace_name: "Test", files: [
      { name: "datos.csv", rel_path: "conversations/conv_test/datos.csv", size: 1024, modified: 0 },
      { name: "app.html", rel_path: "artifacts/app.html", size: 2048, modified: 0 },
    ] });
    vi.spyOn(api, "fsRead").mockResolvedValue({ ok: true, content: "<p>Test</p>", name: "app.html", total_lines: 1 });
    const event = vi.fn(); window.addEventListener("erasmus:open-artifact", event);
    render(<FilesPanel convId="test" refreshKey={0} messages={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Todo el espacio" }));
    await waitFor(() => expect(screen.getByText("app.html")).toBeTruthy());
    expect(screen.queryByRole("tab", { name: "Actividad" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Código" }));
    expect(screen.queryByText("datos.csv")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir app.html" }));
    await waitFor(() => expect(event).toHaveBeenCalledOnce());
    expect(event.mock.calls[0]?.[0].detail).toMatchObject({ lang: "html", code: "<p>Test</p>" });
    window.removeEventListener("erasmus:open-artifact", event);
    expect(fileCategory("reporte.xls")).toBe("tables");
    expect(fileCategory("grafico.svg")).toBe("images");
  });
});
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/chat/Composer";
import { SettingsDialog } from "@/components/shell/SettingsDialog";
import { extractBlocks, parseSegments } from "@/lib/blocks";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/components/shell/CustomInstructions", () => ({ CustomInstructions: () => null }));
vi.mock("@/components/shell/ModelSettings", () => ({ ModelSettings: () => null }));
afterEach(cleanup);

describe("Erasmus Web beta settings", () => {
  it("omits manual testing tabs and shows the model and release date", () => {
    render(<SettingsDialog onClose={vi.fn()} initialTab="about" />);
    expect(screen.queryByRole("tab", { name: "Estado" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Diagnóstico" })).toBeNull();
    expect(screen.getByText("Erasmus Web 1.0 · Beta test")).toBeTruthy();
    expect(screen.getByText("6 de octubre de 2026")).toBeTruthy();
    expect(screen.queryByText(/Licencias/)).toBeNull();
  });

  it("explains that deletion is unavailable without claiming to delete", () => {
    render(<SettingsDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Seguridad" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta" }));
    expect(screen.getByRole("status").textContent).toContain("No se ha eliminado tu cuenta ni enviado ninguna solicitud");
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps existing attachments and reports exactly how many were discarded", () => {
    const onSend = vi.fn();
    const { container } = render(<Composer busy={false} onSend={onSend} onStop={vi.fn()} />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing attachment input");
    const initial = Array.from({ length: 19 }, (_, i) => new File(["text"], `first-${i}.txt`, { type: "text/plain" }));
    fireEvent.change(input, { target: { files: initial } });
    const additional = Array.from({ length: 5 }, (_, i) => new File(["text"], `extra-${i}.txt`, { type: "text/plain" }));
    fireEvent.change(input, { target: { files: additional } });
    expect(screen.getByRole("status").textContent).toContain("Se descartaron 4 archivos adicionales");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSend).toHaveBeenCalledWith("", [...initial, additional[0]]);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders unsupported execution as code and preserves file tool indexes", () => {
    const content = '```code:python\nprint(1)\n```\n```file:write note.txt\nHello\n```';
    expect(extractBlocks(content).map((b) => b.kind)).toEqual(["file:write"]);
    expect(parseSegments(content)[0]).toEqual({ type: "text", text: '```python\nprint(1)\n```' });
    expect(parseSegments(content).find((s) => s.type === "block")).toMatchObject({ index: 0 });
  });
});
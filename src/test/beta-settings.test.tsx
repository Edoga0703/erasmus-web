import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/chat/Composer";
import { SettingsDialog } from "@/components/shell/SettingsDialog";
import { extractBlocks, parseSegments } from "@/lib/blocks";
import { clearSession, getSession, setSession, userKey } from "@/lib/session";

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
    expect(screen.getByText("8 de octubre de 2026")).toBeTruthy();
    expect(screen.queryByText(/Licencias/)).toBeNull();
  });

  it("asks for confirmation and explains exactly what will be lost", () => {
    render(<SettingsDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Seguridad" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta" }));
    const region = screen.getByRole("region", { name: "Confirmación de cuenta" });
    expect(region.textContent).toContain("¿Estás seguro de que deseas eliminar tu cuenta?");
    expect(region.textContent).toContain("Esta acción es definitiva e irreversible");
    expect(region.textContent).toContain("todas tus conversaciones");
    expect(region.textContent).toContain("plan o cupo activo asociado a este código de acceso");
    expect(screen.getByRole("button", { name: "Sí, eliminar mi cuenta definitivamente" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("region", { name: "Confirmación de cuenta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar cuenta" })).toBeTruthy();
  });

  it("clears the session and redirects when deletion is confirmed", () => {
    setSession({ token: "test-session", userId: "test-user", plan: "test", expires: Date.now() + 60000 });
    const key = userKey("chat:regression");
    localStorage.setItem(key, "local history");
    const location = Object.getOwnPropertyDescriptor(window, "location");
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    try {
      render(<SettingsDialog onClose={vi.fn()} initialTab="security" />);
      fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta" }));
      fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar mi cuenta definitivamente" }));
      expect(getSession()).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
      expect(assign).toHaveBeenCalledWith("/entrar");
    } finally {
      if (location) Object.defineProperty(window, "location", location);
      clearSession();
    }
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

  it("preserves nested markdown code fences inside file:write blocks without truncating", () => {
    const mdContent = [
      "```file:write README.md",
      "# Guía",
      "```ts",
      "const x = 42;",
      "```",
      "Fin del documento.",
      "```",
      "Texto final.",
    ].join("\n");
    const blocks = extractBlocks(mdContent);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      kind: "file:write",
      target: "README.md",
      body: "# Guía\n```ts\nconst x = 42;\n```\nFin del documento.",
      closed: true,
    });
    const segs = parseSegments(mdContent);
    expect(segs).toHaveLength(2);
    expect(segs[1]).toEqual({ type: "text", text: "\nTexto final." });
  });

  it("handles nested code fences with attributes and target on the second line without mistaking code for a filename", () => {
    const mdWithAttrs = [
      "```file:write",
      "src/utils.ts",
      "export const demo = true;",
      "```ts title=\"main.ts\"",
      "const y = 100;",
      "```",
      "```",
    ].join("\n");
    const blocks = extractBlocks(mdWithAttrs);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.target).toBe("src/utils.ts");
    expect(blocks[0]?.body).toContain("```ts title=\"main.ts\"\nconst y = 100;\n```");
    expect(blocks[0]?.closed).toBe(true);

    const missingTargetWithCode = [
      "```file:write",
      "console.log('hola');",
      "const z = 1;",
      "```",
    ].join("\n");
    const codeBlocks = extractBlocks(missingTargetWithCode);
    expect(codeBlocks[0]?.target).toBe("");
    expect(codeBlocks[0]?.body).toContain("console.log('hola');");
  });
});
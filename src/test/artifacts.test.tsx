import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { Markdown } from "@/components/chat/Markdown";
import { ARTIFACT_EVENT, ARTIFACT_SANDBOX, artifactDocument, artifactTabDocument, isArtifact } from "@/lib/artifacts";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const artifact = { title: "Aplicación web", code: '<button class="p-4">Hola</button>', lang: "html" };

describe("Artifact canvas", () => {
  it("injects Tailwind once and preserves interactive HTML", () => {
    expect(artifactDocument(artifact)).toContain("https://cdn.tailwindcss.com");
    const code = '<html><head><script src="https://cdn.tailwindcss.com"></script></head><body><button onclick="alert(1)">Hola</button></body></html>';
    const doc = artifactDocument({ ...artifact, code });
    expect(doc.match(/cdn.tailwindcss.com/g)).toHaveLength(1);
    expect(doc).toContain('onclick="alert(1)"');
  });
  it("sanitizes SVG and isolates newly opened tabs", () => {
    const svg = artifactDocument({ ...artifact, lang: "svg", code: '<svg onload="alert(1)"><script>alert(1)</script><circle r="5"/></svg>' });
    expect(svg).not.toContain("onload"); expect(svg).not.toContain("<script");
    const tab = artifactTabDocument('<script>window.parent.localStorage.clear()</script>');
    expect(tab).toContain(`sandbox="${ARTIFACT_SANDBOX}"`);
    expect(tab).not.toContain("allow-same-origin");
    expect(tab).toContain("&lt;script&gt;");
  });
  it("validates events, emits artifact cards, and keeps streaming plain", () => {
    expect(isArtifact(artifact)).toBe(true);
    expect(isArtifact({ ...artifact, lang: "javascript" })).toBe(false);
    const open = vi.fn(); window.addEventListener(ARTIFACT_EVENT, open);
    const source = '```html\n' + Array.from({ length: 11 }, () => '<p>Hola</p>').join('\n') + '\n```';
    const { rerender } = render(<Markdown source={source} streaming />);
    expect(screen.queryByRole("button", { name: /Abrir vista previa/ })).toBeNull();
    rerender(<Markdown source={source} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir vista previa/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0]?.[0].detail).toMatchObject({ lang: "html", title: "Aplicación web" });
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<Markdown source={source + '\nNuevo texto'} />);
    expect(screen.getAllByRole("button", { name: /Abrir vista previa/ })).toHaveLength(1);
    window.removeEventListener(ARTIFACT_EVENT, open);
  });
  it("switches tabs, copies, downloads, opens safely and closes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const onClose = vi.fn();
    const { container } = render(<ArtifactPanel artifact={artifact} onClose={onClose} />);
    expect(container.querySelector("iframe")?.getAttribute("sandbox")).toBe(ARTIFACT_SANDBOX);
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("/artifact-preview.html");
    fireEvent.click(screen.getByRole("tab", { name: "Código" }));
    expect(screen.getByRole("tabpanel").textContent).toContain(artifact.code);
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copiado" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(artifact.code);
    fireEvent.click(screen.getByRole("button", { name: "Descargar archivo" }));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Abrir en nueva pestaña" }));
    expect(open).toHaveBeenCalledWith("blob:test", "_blank", "noopener,noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar vista previa" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
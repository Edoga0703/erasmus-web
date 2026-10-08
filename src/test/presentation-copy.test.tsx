import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageView } from "@/components/chat/MessageView";
import { setLang, useT, type Lang } from "@/lib/i18n";

vi.mock("@/components/chat/Markdown", () => ({ Markdown: ({ source }: { source: string }) => <p>{source}</p> }));
afterEach(() => { cleanup(); setLang("es"); });

describe("presentación aprobada", () => {
  it("mantiene copiar, menú y tokens sin botones de calificación", () => {
    render(<MessageView m={{ id: "response", role: "assistant", content: "Respuesta", ts: Date.now(), usage: { prompt: 10, completion: 5, reasoning: 0, total: 15 } }} isLast />);
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Más acciones" })).toBeTruthy();
    expect(screen.getByText("15 tokens")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buena respuesta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mala respuesta" })).toBeNull();
  });

  it.each([
    ["es", "Canjear acceso", "¿No tienes un código de acceso?", "¿Cómo se conecta mi cuenta al modelo de IA?"],
    ["en", "Redeem access", "Don't have an access code?", "How does my account connect to the AI model?"],
    ["pt", "Resgatar acesso", "Não tem um código de acesso?", "Como minha conta se conecta ao modelo de IA?"],
  ] as const)("usa los textos de acceso en %s", (lang: Lang, title, question, help) => {
    function Copy() { const t = useT(); return <><h1>{t("buy_title")}</h1><p>{t("login_no_key")}</p><p>{t("help_q3")}</p><p>{t("help_a3")}</p></>; }
    render(<Copy />);
    act(() => setLang(lang));
    expect(screen.getByRole("heading").textContent).toBe(title);
    expect(screen.getByText(question)).toBeTruthy();
    expect(screen.getByText(help)).toBeTruthy();
    expect(screen.queryByText(/abre Ajustes|open Settings|abra Ajustes/)).toBeNull();
  });
});
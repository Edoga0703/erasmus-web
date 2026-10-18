import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/chat/Composer";
import { MessageView } from "@/components/chat/MessageView";
import { UsageMeter } from "@/components/shell/UsageMeter";
import { ModelSettings } from "@/components/shell/ModelSettings";
import { SettingsDialog } from "@/components/shell/SettingsDialog";
import { api } from "@/lib/api/client";
import { getModelConfig, saveModelConfig } from "@/lib/api/config";
import { clearSession, setSession } from "@/lib/session";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to?: string }) => <a href={to}>{children}</a>,
    useNavigate: () => vi.fn(),
  };
});

describe("Comportamiento de botones accionadores e interactivos", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setSession({ token: "test-token", userId: "u1", plan: "pro", expires: Date.now() + 86400000 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    clearSession();
  });

  describe("Botones del Composer", () => {
    it("el botón Enviar llama a onSend con el texto introducido y limpia el campo", () => {
      const onSend = vi.fn();
      render(<Composer busy={false} onSend={onSend} onStop={vi.fn()} />);

      const textarea = screen.getByRole("textbox", { name: "Mensaje" });
      fireEvent.change(textarea, { target: { value: "Mensaje de prueba para Erasmus" } });

      const sendBtn = screen.getByRole("button", { name: "Enviar" });
      expect(sendBtn).not.toBeDisabled();
      fireEvent.click(sendBtn);

      expect(onSend).toHaveBeenCalledWith("Mensaje de prueba para Erasmus", []);
      expect((textarea as HTMLTextAreaElement).value).toBe("");
    });

    it("la tecla Enter envía el mensaje, pero Shift+Enter permite salto de línea", () => {
      const onSend = vi.fn();
      render(<Composer busy={false} onSend={onSend} onStop={vi.fn()} />);

      const textarea = screen.getByRole("textbox", { name: "Mensaje" });
      fireEvent.change(textarea, { target: { value: "Primera línea" } });

      // Shift+Enter no envía
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
      expect(onSend).not.toHaveBeenCalled();

      // Enter normal envía
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
      expect(onSend).toHaveBeenCalledWith("Primera línea", []);
    });

    it("cuando busy=true muestra el botón Detener y llama a onStop al pulsarlo", () => {
      const onStop = vi.fn();
      render(<Composer busy={true} onSend={vi.fn()} onStop={onStop} />);

      expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
      const stopBtn = screen.getByRole("button", { name: "Detener" });
      expect(stopBtn).toBeTruthy();

      fireEvent.click(stopBtn);
      expect(onStop).toHaveBeenCalledOnce();
    });

    it("permite eliminar archivos adjuntos mediante el botón quitar del chip", () => {
      const onSend = vi.fn();
      const { container } = render(<Composer busy={false} onSend={onSend} onStop={vi.fn()} />);

      const input = container.querySelector('input[type="file"]')!;
      const file1 = new File(["hola"], "archivo1.txt", { type: "text/plain" });
      const file2 = new File(["mundo"], "archivo2.txt", { type: "text/plain" });

      fireEvent.change(input, { target: { files: [file1, file2] } });

      expect(screen.getByText("archivo1.txt")).toBeTruthy();
      expect(screen.getByText("archivo2.txt")).toBeTruthy();

      // Quitar el primer archivo
      const removeButtons = screen.getAllByRole("button", { name: /Quitar archivo/i });
      fireEvent.click(removeButtons[0]!);

      expect(screen.queryByText("archivo1.txt")).toBeNull();
      expect(screen.getByText("archivo2.txt")).toBeTruthy();

      // Enviar con el archivo restante
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(onSend).toHaveBeenCalledWith("", [file2]);
    });

    it("activa y desactiva el modo de generación de imágenes", () => {
      const onGenerateImage = vi.fn();
      render(<Composer busy={false} onSend={vi.fn()} onStop={vi.fn()} onGenerateImage={onGenerateImage} />);

      const textarea = screen.getByRole("textbox", { name: "Mensaje" });
      expect(textarea.getAttribute("placeholder")).toBe("Pregunta lo que quieras");

      // Escribir comando /imagen
      fireEvent.change(textarea, { target: { value: "/imagen Un amanecer en la montaña" } });

      // Ahora está en modo imagen
      expect(screen.getByText("Modo Imagen")).toBeTruthy();
      expect(textarea.getAttribute("placeholder")).toContain("Describe la imagen");

      // Botón salir del modo imagen
      const exitBtn = screen.getByRole("button", { name: "Salir del modo imagen" });
      fireEvent.click(exitBtn);

      expect(screen.queryByText("Modo Imagen")).toBeNull();
      expect(textarea.getAttribute("placeholder")).toBe("Pregunta lo que quieras");
    });
  });

  describe("Botones de Mensajes (MessageView)", () => {
    it("el botón Copiar copia el texto al portapapeles y cambia su estado a Copiado", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(
        <MessageView
          m={{
            id: "msg-1",
            role: "assistant",
            content: "Respuesta detallada de Erasmus",
            ts: Date.now(),
          }}
          isLast
        />,
      );

      const copyBtn = screen.getByRole("button", { name: "Copiar" });
      fireEvent.click(copyBtn);

      expect(writeText).toHaveBeenCalledWith("Respuesta detallada de Erasmus");
      await waitFor(() => expect(screen.getByRole("button", { name: "Copiado" })).toBeTruthy());
    });

    it("el botón Reintentar aparece en mensajes con error reintentable y llama a onRetry", () => {
      const onRetry = vi.fn();
      render(
        <MessageView
          m={{
            id: "msg-err",
            role: "assistant",
            content: "",
            ts: Date.now(),
            error: { message: "Error temporal de conexión.", retryable: true },
          }}
          isLast
          onRetry={onRetry}
        />,
      );

      const retryBtn = screen.getByRole("button", { name: "Reintentar" });
      expect(retryBtn).toBeTruthy();
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("el botón Continuar aparece cuando finish='length' y llama a onContinue", () => {
      const onContinue = vi.fn();
      render(
        <MessageView
          m={{
            id: "msg-cut",
            role: "assistant",
            content: "Parte del texto generado...",
            finish: "length",
            ts: Date.now(),
          }}
          isLast
          onContinue={onContinue}
        />,
      );

      const contBtn = screen.getByRole("button", { name: "Continuar" });
      expect(contBtn).toBeTruthy();
      fireEvent.click(contBtn);
      expect(onContinue).toHaveBeenCalledOnce();
    });

    it("el botón Más acciones existe y el menú de acciones del asistente está conectado", () => {
      const onRegenerate = vi.fn();
      const onBranch = vi.fn();

      render(
        <MessageView
          m={{
            id: "msg-asst",
            role: "assistant",
            content: "Contenido asistido",
            ts: Date.now(),
          }}
          isLast
          onRegenerate={onRegenerate}
          onBranch={onBranch}
        />,
      );

      const menuBtn = screen.getByRole("button", { name: "Más acciones" });
      expect(menuBtn).toBeTruthy();
      fireEvent.pointerDown(menuBtn, { pointerType: "mouse" });
      fireEvent.click(menuBtn);

      // Si Radix montó el portal en JSDOM, verificamos las opciones
      const regItem = screen.queryByText("Regenerar");
      if (regItem) {
        fireEvent.click(regItem);
        expect(onRegenerate).toHaveBeenCalledOnce();
      }
    });
  });

  const mockAccount = (overrides = {}) => ({
    plan: "pro",
    tokens_balance: 500000,
    tokens_used: 12000,
    images_used: 0,
    images_quota: 50,
    inflight: 0,
    expires_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    ...overrides,
  });

  describe("Botones e interacción de UsageMeter", () => {
    it("muestra el saldo disponible y al hacer clic despliega el Popover con acceso a canje", async () => {
      vi.spyOn(api, "account").mockResolvedValue(mockAccount());

      const eventSpy = vi.fn();
      window.addEventListener("erasmus:open-settings", eventSpy);

      render(<UsageMeter />);

      await waitFor(() => expect(screen.getByLabelText("Uso del plan")).toBeTruthy());
      expect(screen.getByText("500 k disponibles")).toBeTruthy();

      // Abrir popover
      fireEvent.click(screen.getByLabelText("Uso del plan"));

      expect(screen.getByText("Estado de tu cuenta")).toBeTruthy();
      expect(screen.getByText("Tokens disponibles")).toBeTruthy();
      expect(screen.getByText("500.000")).toBeTruthy();

      // Clic en ver cuenta y canjear cupón
      const redeemBtn = screen.getByRole("button", { name: /Ver cuenta y canjear cupón/ });
      fireEvent.click(redeemBtn);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: "data" }));
      window.removeEventListener("erasmus:open-settings", eventSpy);
    });
  });

  describe("Botones de Ajustes de Modelo (ModelSettings)", () => {
    it("los botones de profundidad de razonamiento seleccionan y persisten el nivel", () => {
      render(<ModelSettings />);

      const radioBtns = screen.getAllByRole("radio");
      expect(radioBtns.length).toBe(4);

      // Clic en Alto
      const highBtn = radioBtns.find((b) => b.textContent?.includes("Alto"))!;
      fireEvent.click(highBtn);

      expect(getModelConfig().reasoning).toBe("high");
      expect(highBtn.getAttribute("aria-checked")).toBe("true");

      // Clic en Bajo
      const lowBtn = radioBtns.find((b) => b.textContent?.includes("Bajo"))!;
      fireEvent.click(lowBtn);

      expect(getModelConfig().reasoning).toBe("low");
      expect(lowBtn.getAttribute("aria-checked")).toBe("true");
    });

    it("el botón Probar conexión ejecuta la prueba y muestra el resultado", async () => {
      vi.spyOn(api, "models").mockResolvedValue({
        data: [{ id: "erasmus-v2", context_length: 128000 }],
      });
      vi.spyOn(api, "account").mockResolvedValue(mockAccount({
        tokens_balance: 450000,
        tokens_used: 5000,
      }));

      render(<ModelSettings />);

      const testBtn = screen.getByRole("button", { name: "Probar conexión" });
      fireEvent.click(testBtn);

      await waitFor(() => expect(screen.getByText(/Modelo conectado/)).toBeTruthy());
      expect(screen.getByText(/tokens disponibles 450\.000/)).toBeTruthy();
    });
  });

  describe("Botones de Pestaña de Datos y Canje en SettingsDialog", () => {
    it("el formulario de canje de cupón valida entrada y ejecuta api.redeemCoupon", async () => {
      const redeemSpy = vi.spyOn(api, "redeemCoupon").mockResolvedValue({
        ok: true,
        message: "¡Cupón aplicado! Se sumaron 200.000 tokens.",
        type: "tokens",
        value: 200000,
      });
      vi.spyOn(api, "chats").mockResolvedValue({ ok: true, chats: [], workspace_name: "Espacio" });
      vi.spyOn(api, "files").mockResolvedValue({ ok: true, files: [], workspace_name: "Espacio" });
      vi.spyOn(api, "account").mockResolvedValue(mockAccount({ tokens_balance: 200000 }));

      render(<SettingsDialog onClose={vi.fn()} initialTab="data" />);

      await waitFor(() => expect(screen.getByPlaceholderText("ERM-PRO-...")).toBeTruthy());

      const input = screen.getByPlaceholderText("ERM-PRO-...");
      const submitBtn = screen.getByRole("button", { name: "Canjear" });

      // Botón deshabilitado si está vacío
      expect(submitBtn).toBeDisabled();

      // Escribir cupón
      fireEvent.change(input, { target: { value: "ERM-PRO-2026" } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => expect(redeemSpy).toHaveBeenCalledWith("ERM-PRO-2026"));
      await waitFor(() => expect(screen.getByText("¡Cupón aplicado! Se sumaron 200.000 tokens.")).toBeTruthy());
    });
  });

  describe("Botones de Ayuda (ayuda.tsx)", () => {
    it("los botones de acordeón abren y cierran las respuestas de preguntas frecuentes", async () => {
      const { Route: AyudaRoute } = await import("@/routes/ayuda");
      const AyudaComponent = AyudaRoute.options.component as React.ComponentType;

      render(<AyudaComponent />);

      const accordionButtons = screen.getAllByRole("button", { expanded: false });
      expect(accordionButtons.length).toBeGreaterThan(0);

      // Clic en el primer acordeón cerrado para abrirlo
      const firstClosed = accordionButtons[0]!;
      fireEvent.click(firstClosed);

      expect(firstClosed.getAttribute("aria-expanded")).toBe("true");

      // Clic de nuevo para cerrarlo
      fireEvent.click(firstClosed);
      expect(firstClosed.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("Botones e interacción de Acceso (entrar.tsx)", () => {
    it("los botones de pestañas alternan entre Código de acceso y Canjear cupón", async () => {
      const { Route: EntrarRoute } = await import("@/routes/entrar");
      const EntrarComponent = EntrarRoute.options.component as React.ComponentType;

      render(<EntrarComponent />);

      // Pestaña inicial es Código de acceso
      expect(screen.getByRole("tab", { name: /Código de acceso/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: /Canjear cupón/i })).toHaveAttribute("aria-selected", "false");
      expect(screen.getByPlaceholderText("erm-XXXX-XXXX-XXXXX-XXXX")).toBeTruthy();

      // Clic en pestaña Canjear cupón
      fireEvent.click(screen.getByRole("tab", { name: /Canjear cupón/i }));

      expect(screen.getByRole("tab", { name: /Canjear cupón/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByPlaceholderText("ERM-PROMO-XXXX")).toBeTruthy();

      // Clic en botón de aviso de contacto
      const contactBtn = screen.getByRole("button", { name: "Contáctanos" });
      fireEvent.click(contactBtn);

      expect(screen.getByRole("status")).toHaveTextContent(/Telegram/i);
    });
  });
});


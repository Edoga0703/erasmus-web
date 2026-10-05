import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

export function Composer({ busy, disabled, onSend, onStop }: { busy: boolean; disabled?: boolean; onSend: (t: string) => void; onStop: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!text.trim() || busy || disabled) return;
    onSend(text);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className="border-t border-e-line bg-e-bg2 px-4 pt-2.5 pb-3">
      <div className="e-row mx-auto max-w-3xl">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={disabled ? "Sin conexión con el puente" : "Escribe un mensaje…"}
          aria-label="Mensaje"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 220) + "px";
          }}
          onKeyDown={onKey}
          className="max-h-[220px] min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-e-tx outline-none placeholder:text-e-dim"
        />
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Detener" className="inline-flex size-8 items-center justify-center rounded-lg bg-e-acc text-e-bg2">
            <Square className="size-3.5" fill="currentColor" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={!text.trim() || disabled} aria-label="Enviar" className="inline-flex size-8 items-center justify-center rounded-lg bg-e-acc text-e-bg2 disabled:opacity-30">
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
      <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-e-dim">Enter para enviar · Shift+Enter nueva línea</p>
    </section>
  );
}

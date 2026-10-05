import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCustomInstructions, saveCustomInstructions } from "@/lib/api/config";

const MAX = 1500;

/** Ajustes → Personalización: ChatGPT-style custom instructions, sent as system context on every turn. */
export function CustomInstructions() {
  const [about, setAbout] = useState("");
  const [style, setStyle] = useState("");
  useEffect(() => { const c = getCustomInstructions(); setAbout(c.about); setStyle(c.style); }, []);
  const box = "mt-1.5 min-h-[110px] w-full resize-y rounded-xl border border-e-line bg-e-bg2 px-3 py-2 text-[14px] outline-none focus:border-e-dim";
  const save = () => { saveCustomInstructions({ about, style }); toast.success("Personalización guardada. Se aplica a los próximos mensajes."); };
  return (
    <section className="space-y-5" data-custom-instructions>
      <p className="text-[13px] text-e-dim">Erasmus tendrá esto en cuenta en todas tus conversaciones. Se guarda en este navegador.</p>
      <label className="block text-[14px] font-medium">¿Qué debe saber Erasmus de ti o de tu empresa?
        <textarea className={box} maxLength={MAX} value={about} onChange={(e) => setAbout(e.target.value)}
          placeholder="Ej.: Tengo una panadería con 3 locales en Lima, 12 empleados. Vendo también por WhatsApp." aria-label="Sobre ti o tu empresa" />
        <span className="block text-right text-[11.5px] font-normal text-e-dim">{about.length}/{MAX}</span>
      </label>
      <label className="block text-[14px] font-medium">¿Cómo quieres que responda Erasmus?
        <textarea className={box} maxLength={MAX} value={style} onChange={(e) => setStyle(e.target.value)}
          placeholder="Ej.: Respuestas directas, con números y pasos concretos. Tono cercano. Precios en soles." aria-label="Cómo debe responder" />
        <span className="block text-right text-[11.5px] font-normal text-e-dim">{style.length}/{MAX}</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={save} className="rounded-full bg-e-acc px-4 py-2 text-[14px] font-medium text-e-bg2">Guardar</button>
        <button type="button" onClick={() => { setAbout(""); setStyle(""); saveCustomInstructions({ about: "", style: "" }); }} className="rounded-full border border-e-line px-4 py-2 text-[14px] hover:bg-e-bg3">Borrar</button>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages, Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { setLang, useLang, useT } from "@/lib/i18n";

/** Shared header for the public pages (landing, entrar, ayuda, estado). */
export function PublicHeader() {
  const theme = useTheme();
  const lang = useLang();
  const t = useT();
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!languageOpen) return;
    const close = (event: PointerEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [languageOpen]);

  const languages = [
    { code: "es" as const, label: "Español" },
    { code: "en" as const, label: "English" },
    { code: "pt" as const, label: "Português" },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-e-line/60 bg-e-bg2/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 sm:px-5">
        <Link to="/" className="mr-auto text-[17px] font-semibold tracking-tight">Erasmus</Link>
        <Link to="/ayuda" className="hidden rounded-full px-3 py-1.5 text-[14px] text-e-dim hover:bg-e-bg3 hover:text-e-tx sm:block">{t("nav_help")}</Link>
        <Link to="/estado" className="hidden rounded-full px-3 py-1.5 text-[14px] text-e-dim hover:bg-e-bg3 hover:text-e-tx sm:block">{t("nav_status")}</Link>
        <div ref={languageRef} className="relative w-[62px] shrink-0">
          <button
            className="flex h-9 w-[62px] items-center justify-center gap-1 rounded-full text-e-dim hover:bg-e-bg3 hover:text-e-tx"
            aria-label="Seleccionar idioma"
            aria-haspopup="menu"
            aria-expanded={languageOpen}
            onClick={() => setLanguageOpen((open) => !open)}
          >
            <Languages className="size-4" /><span className="w-5 text-center text-[11px] font-semibold uppercase">{lang}</span><ChevronDown className="size-3" />
          </button>
          {languageOpen && (
            <div role="menu" className="e-pop absolute right-0 top-11 w-44 overflow-hidden p-1.5">
              {languages.map((item) => (
                <button key={item.code} role="menuitemradio" aria-checked={lang === item.code}
                  className="flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[14px] hover:bg-e-bg3"
                  onClick={() => { setLang(item.code); setLanguageOpen(false); }}>
                  <span className="flex-1">{item.label}</span>{lang === item.code && <Check className="size-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="e-icon-btn" aria-label="Cambiar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <Link to="/entrar" className="hidden w-[68px] shrink-0 rounded-full px-2 py-1.5 text-center text-[14px] hover:bg-e-bg3 md:block">{t("nav_login")}</Link>
        <Link to="/entrar" className="w-[94px] shrink-0 rounded-full bg-e-acc px-2 py-1.5 text-center text-[14px] font-medium text-e-bg2">{t("nav_start")}</Link>
      </div>
      <nav className="mx-auto flex h-10 max-w-6xl items-center gap-5 overflow-x-auto border-t border-e-line/60 px-4 text-[13px] text-e-dim sm:hidden" aria-label="Navegación pública">
        <Link to="/ayuda" className="hover:text-e-tx">{t("nav_help")}</Link>
        <Link to="/estado" className="hover:text-e-tx">{t("nav_status")}</Link>
        <Link to="/privacidad" className="hover:text-e-tx">{t("nav_privacy")}</Link>
        <Link to="/entrar" className="hover:text-e-tx">{t("nav_login")}</Link>
      </nav>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { Languages, Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { setLang, useLang, useT } from "@/lib/i18n";

/** Shared header for the public pages (landing, entrar, ayuda, estado). */
export function PublicHeader() {
  const theme = useTheme();
  const lang = useLang();
  const t = useT();
  return (
    <header className="sticky top-0 z-10 border-b border-e-line/60 bg-e-bg2/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-5">
        <Link to="/" className="mr-auto text-[17px] font-semibold tracking-tight">Erasmus</Link>
        <Link to="/ayuda" className="hidden rounded-full px-3 py-1.5 text-[14px] text-e-dim hover:bg-e-bg3 hover:text-e-tx sm:block">{t("nav_help")}</Link>
        <Link to="/estado" className="hidden rounded-full px-3 py-1.5 text-[14px] text-e-dim hover:bg-e-bg3 hover:text-e-tx sm:block">{t("nav_status")}</Link>
        <button
          className="e-icon-btn"
          aria-label={lang === "es" ? "Switch to English" : "Cambiar a español"}
          title={lang === "es" ? "English" : "Español"}
          onClick={() => setLang(lang === "es" ? "en" : "es")}
        >
          <span className="flex items-center gap-1"><Languages className="size-4" /><span className="text-[11px] font-semibold uppercase">{lang}</span></span>
        </button>
        <button className="e-icon-btn" aria-label="Cambiar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <Link to="/entrar" className="rounded-full px-3 py-1.5 text-[14px] hover:bg-e-bg3">{t("nav_login")}</Link>
        <Link to="/entrar" className="rounded-full bg-e-acc px-4 py-1.5 text-[14px] font-medium text-e-bg2">{t("nav_start")}</Link>
      </div>
    </header>
  );
}

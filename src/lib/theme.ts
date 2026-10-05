import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
export const THEME_KEY = "erasmus.theme";

/** Inline pre-paint script (root <head>): applies the persisted theme before hydration to avoid a flash. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}`;

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setTheme(t: Theme): void {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ }
}

/** Current theme; updates on any <html data-theme> change (drives chart/mermaid re-render). */
export function useTheme(): Theme {
  const [t, setT] = useState<Theme>("dark");
  useEffect(() => {
    setT(getTheme());
    const obs = new MutationObserver(() => setT(getTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

/** Single source of truth for the API base URL and mock switch. */
export const API_BASE: string = String(import.meta.env['VITE_API_BASE'] ?? "/erasmus-api").replace(/\/+$/, "");
export const MOCK: boolean = import.meta.env['VITE_MOCK'] === "1";

const TOKEN_KEY = "erasmus_bridge_token";

/** Captures ?t=<token> into sessionStorage and strips it from the URL. Call from useEffect. */
export function captureTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t) {
      sessionStorage.setItem(TOKEN_KEY, t);
      params.delete("t");
      const qs = params.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (qs ? `?${qs}` : ""));
    } else if (MOCK && !sessionStorage.getItem(TOKEN_KEY)) {
      // Mock-only demo token so the preview is navigable; never used in real mode.
      sessionStorage.setItem(TOKEN_KEY, "mock-token");
    }
  } catch {
    /* storage unavailable */
  }
}

let captured = false;

export function getToken(): string {
  if (typeof window === "undefined") return "";
  if (!captured) {
    captured = true;
    captureTokenFromUrl();
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

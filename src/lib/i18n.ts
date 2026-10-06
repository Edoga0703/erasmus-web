import { useSyncExternalStore } from "react";

export type Lang = "es" | "en";
const KEY = "erasmus.lang";
const listeners = new Set<() => void>();

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "es") return v;
  } catch { /* ignore */ }
  return "es";
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getLang,
  );
}

const dict = {
  es: {
    nav_help: "Ayuda",
    nav_status: "Estado",
    nav_login: "Entrar",
    nav_start: "Empezar",
    hero_kicker: "Sin correo · Un código y entras",
    hero_title: "El agente de IA que trabaja para tu empresa",
    hero_sub: "Chat, documentos, gráficos e imágenes en un solo lugar. Cada cuenta es un espacio privado: nada se mezcla con nadie.",
    hero_placeholder: "Pregunta lo que necesites",
    hero_note: "Necesitas un código de acceso para empezar.",
    feat1_title: "Pregunta. Responde.",
    feat1_text: "Respuestas claras y estructuradas para decisiones de negocio, con razonamiento ajustable y conversaciones que no se pierden.",
    feat2_title: "Lee lo que le das",
    feat2_text: "Adjunta textos, hojas y documentos: Erasmus los analiza, resume y te devuelve tablas, gráficos y diagramas.",
    feat3_title: "Ve y crea",
    feat3_text: "Interpreta las imágenes que subes y genera nuevas cuando tu plan lo incluye.",
    how_title: "Así de simple",
    how1_t: "Recibe tu código",
    how1_d: "Tu administrador te entrega un código de acceso único. No hay registros ni formularios.",
    how2_t: "Entra y pregunta",
    how2_d: "Escribe tu código y empieza a conversar. Tu espacio es solo tuyo desde el primer mensaje.",
    how3_t: "Trabaja con resultados",
    how3_d: "Exporta conversaciones, descarga archivos y reutiliza lo que Erasmus crea para ti.",
    priv_title: "Privado por diseño",
    priv_text: "Cada código abre un espacio completamente separado. Tus conversaciones, archivos y ajustes no se cruzan con los de ningún otro usuario. Al cerrar sesión, el navegador no guarda nada tuyo.",
    priv1: "Espacio aislado por cuenta",
    priv2: "Sin correo ni datos personales",
    priv3: "Cierre de sesión que borra todo",
    footer_rights: "© Erasmus",
    // estado
    status_title: "Estado del servicio",
    status_sub: "Comprobación en directo de la conexión con Erasmus.",
    status_ok: "Operativo",
    status_down: "No disponible",
    status_checking: "Comprobando…",
    status_latency: "Latencia",
    status_model: "Modelo activo",
    status_workspace: "Espacio de trabajo",
    status_retry: "Volver a comprobar",
    status_updated: "Última comprobación",
    // ayuda
    help_title: "Ayuda",
    help_sub: "Respuestas a las dudas más habituales.",
    help_q1: "¿Qué es el código de acceso?",
    help_a1: "Es una clave con formato erm-XXXX-XXXX-XXXXX-XXXX que te entrega tu administrador. Es tu única credencial: no necesitas correo ni contraseña.",
    help_q2: "¿Qué hago si pierdo mi código?",
    help_a2: "Contacta con tu administrador. Por seguridad, los códigos no se pueden recuperar desde la web: se genera uno nuevo y se desactiva el anterior.",
    help_q3: "¿Cómo activo mi clave del modelo?",
    help_a3: "Dentro del chat, abre Ajustes y pega tu clave en la sección del modelo. La clave se guarda solo en tu navegador y nunca se muestra completa.",
    help_q4: "¿Mis conversaciones son privadas?",
    help_a4: "Sí. Cada cuenta tiene un espacio totalmente separado: tus conversaciones y archivos no los ve ningún otro usuario. Al cerrar sesión se borra todo lo guardado en el navegador.",
    help_q5: "¿Puedo usar Erasmus en el móvil?",
    help_a5: "Sí, la web está adaptada a pantallas pequeñas: paneles plegables, gestos y la misma experiencia que en el ordenador.",
    help_q6: "¿Qué pasa si el servicio no responde?",
    help_a6: "Revisa la página de Estado. Si aparece operativo y aun así falla, espera unos segundos y reintenta; las respuestas en curso se reanudan solas.",
    help_cta: "¿Otra duda? Pregúntale a Erasmus directamente dentro del chat.",
  },
  en: {
    nav_help: "Help",
    nav_status: "Status",
    nav_login: "Sign in",
    nav_start: "Get started",
    hero_kicker: "No email · One code and you're in",
    hero_title: "The AI agent that works for your business",
    hero_sub: "Chat, documents, charts and images in one place. Every account is a private space: nothing mixes with anyone else's.",
    hero_placeholder: "Ask anything you need",
    hero_note: "You need an access code to start.",
    feat1_title: "Ask. It answers.",
    feat1_text: "Clear, structured answers for business decisions, with adjustable reasoning and conversations that never get lost.",
    feat2_title: "Reads what you give it",
    feat2_text: "Attach texts, sheets and documents: Erasmus analyzes and summarizes them, and gives you back tables, charts and diagrams.",
    feat3_title: "Sees and creates",
    feat3_text: "Interprets the images you upload and generates new ones when your plan includes it.",
    how_title: "That simple",
    how1_t: "Get your code",
    how1_d: "Your administrator hands you a unique access code. No sign-ups, no forms.",
    how2_t: "Sign in and ask",
    how2_d: "Type your code and start chatting. Your space is yours alone from the first message.",
    how3_t: "Work with results",
    how3_d: "Export conversations, download files and reuse what Erasmus creates for you.",
    priv_title: "Private by design",
    priv_text: "Each code opens a fully separate space. Your conversations, files and settings never cross with any other user's. When you sign out, the browser keeps nothing of yours.",
    priv1: "Isolated space per account",
    priv2: "No email or personal data",
    priv3: "Sign-out wipes everything",
    footer_rights: "© Erasmus",
    status_title: "Service status",
    status_sub: "Live check of the connection to Erasmus.",
    status_ok: "Operational",
    status_down: "Unavailable",
    status_checking: "Checking…",
    status_latency: "Latency",
    status_model: "Active model",
    status_workspace: "Workspace",
    status_retry: "Check again",
    status_updated: "Last checked",
    help_title: "Help",
    help_sub: "Answers to the most common questions.",
    help_q1: "What is the access code?",
    help_a1: "It's a key in the format erm-XXXX-XXXX-XXXXX-XXXX that your administrator gives you. It's your only credential: no email, no password.",
    help_q2: "What if I lose my code?",
    help_a2: "Contact your administrator. For security, codes can't be recovered from the web: a new one is generated and the old one is deactivated.",
    help_q3: "How do I activate my model key?",
    help_a3: "Inside the chat, open Settings and paste your key in the model section. The key is stored only in your browser and is never shown in full.",
    help_q4: "Are my conversations private?",
    help_a4: "Yes. Every account has a fully separate space: no other user can see your conversations or files. Signing out wipes everything stored in the browser.",
    help_q5: "Can I use Erasmus on my phone?",
    help_a5: "Yes, the web is adapted to small screens: collapsible panels, gestures and the same experience as on desktop.",
    help_q6: "What if the service doesn't respond?",
    help_a6: "Check the Status page. If it shows operational and it still fails, wait a few seconds and retry; in-progress answers resume on their own.",
    help_cta: "Another question? Ask Erasmus directly inside the chat.",
  },
} as const;

export type TKey = keyof (typeof dict)["es"];

export function useT() {
  const lang = useLang();
  return (k: TKey): string => dict[lang][k];
}

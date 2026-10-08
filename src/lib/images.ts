import { API_BASE } from "@/lib/api/config";

export type ImageSize = "1024x1024" | "1792x1024" | "1024x1792";
export const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: "1024x1024", label: "1:1 Cuadrado" },
  { value: "1792x1024", label: "16:9 Panorámico" },
  { value: "1024x1792", label: "9:16 Vertical" },
];
export const IMAGE_VIEW_EVENT = "erasmus:view-image";
export interface ImageDetail { src: string; alt: string; fromUser: boolean }
export function imageUrl(src: string): string | null {
  if (/^\/api\/images\/[\w./%?=&-]+$/.test(src)) return API_BASE + src;
  if (src.startsWith(`${API_BASE}/api/images/`) && /^[\w./:%?=&-]+$/.test(src)) return src;
  try {
    const url = new URL(src);
    if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return url.href;
  } catch { /* not a safe URL */ }
  return null;
}
export function isImageDetail(value: unknown): value is ImageDetail {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ImageDetail>;
  return typeof v.src === "string" && typeof v.alt === "string" && typeof v.fromUser === "boolean" && Boolean(imageUrl(v.src));
}
export function cleanImagePrompt(prompt: string): string {
  return prompt.replace(/^\/(?:imagen|image)(?:\s+|$)/i, "").trim();
}
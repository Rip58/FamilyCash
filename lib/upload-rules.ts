/**
 * Reglas de subida compartidas por cliente y servidor (puras, testeables).
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_PHOTOS_PER_REPORT = 6;
export const UPLOAD_PREFIX = "reports/";
/** Ruta pública (protegida por sesión) de los archivos en modo local. */
export const LOCAL_FILES_BASE = "/api/files/";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function isAllowedImageType(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function extensionFor(type: string): string | null {
  return EXT[type] ?? null;
}

export type UploadCheck = { ok: true } | { ok: false; error: string };

/** Valida tipo y tamaño de un archivo antes de subirlo / guardarlo. */
export function validateUpload(type: string, size: number): UploadCheck {
  if (!isAllowedImageType(type)) return { ok: false, error: "Formato no admitido (usa JPEG, PNG o WebP)." };
  if (size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: "La imagen supera los 8 MB." };
  return { ok: true };
}

/** Detecta el tipo real por los primeros bytes (no nos fiamos del Content-Type). */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Un pathname de almacenamiento es válido si es relativo, bajo `reports/` y sin trucos. */
export function isSafePathname(p: string): boolean {
  if (!p.startsWith(UPLOAD_PREFIX) || p.length > 200) return false;
  if (p.includes("..") || p.includes("\\") || p.includes("//") || p.includes("\0")) return false;
  return /^[A-Za-z0-9._\-/]+$/.test(p);
}

/** La URL de una foto debe corresponder a su pathname (local o Vercel Blob). */
export function isPhotoUrlFor(url: string, pathname: string): boolean {
  if (!isSafePathname(pathname)) return false;
  if (url === `${LOCAL_FILES_BASE}${pathname}`) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && decodeURIComponent(u.pathname) === `/${pathname}`;
  } catch {
    return false;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2).replace(".", ",")} GB`;
}

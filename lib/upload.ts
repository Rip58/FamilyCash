/**
 * Subida de fotos desde el cliente: `uploadPhoto` comprime la foto (WebP ≤ 600 KB) y la envía a
 * /api/upload/photo, que la guarda en Vercel Blob (privado) o, en desarrollo, en `.uploads/`.
 */
import { compressImage } from "./image-compress";
import { extensionFor, validateUpload } from "./upload-rules";

export type StorageMode = "blob" | "local";

export interface UploadedPhoto {
  url: string;
  pathname: string;
  width: number;
  height: number;
  size: number;
}

export interface UploadOptions {
  /** Informativo: el servidor decide dónde guardar. */
  mode?: StorageMode;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

function send(blob: Blob, opts: UploadOptions): Promise<{ url: string; pathname: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/photo");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error("Sin conexión. Inténtalo de nuevo."));
    xhr.onabort = () => reject(new Error("Subida cancelada."));
    xhr.onload = () => {
      let body: { url?: string; pathname?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.url && body.pathname) {
        resolve({ url: body.url, pathname: body.pathname });
      } else {
        reject(new Error(body.error ?? "No se pudo subir la foto."));
      }
    };
    opts.signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", blob, `foto.${extensionFor(blob.type) ?? "webp"}`);
    xhr.send(form);
  });
}

/** Comprime (WebP 0,95, 1600 px, ≤ 600 KB) y sube una foto. Lanza Error con mensaje en español. */
export async function uploadPhoto(file: File, opts: UploadOptions): Promise<UploadedPhoto> {
  if (file.size === 0) throw new Error("El archivo está vacío.");
  const { blob, width, height } = await compressImage(file);
  const check = validateUpload(blob.type, blob.size);
  if (!check.ok) throw new Error(check.error);
  opts.onProgress?.(0);
  const stored = await send(blob, opts);
  opts.onProgress?.(1);
  return { ...stored, width, height, size: blob.size };
}

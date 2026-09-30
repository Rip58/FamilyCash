/**
 * Subida de fotos desde el cliente. Una única función `uploadPhoto` que elige
 * el modo según el flag que expone el servidor (hay BLOB_READ_WRITE_TOKEN o no):
 *  - "blob":  subida directa a Vercel Blob (`@vercel/blob/client`).
 *  - "local": POST multipart a /api/upload/local (desarrollo).
 */
import { compressImage } from "./image-compress";
import { UPLOAD_PREFIX, validateUpload } from "./upload-rules";

export type StorageMode = "blob" | "local";

export interface UploadedPhoto {
  url: string;
  pathname: string;
  width: number;
  height: number;
  size: number;
}

export interface UploadOptions {
  mode: StorageMode;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

function uploadLocal(blob: Blob, opts: UploadOptions): Promise<{ url: string; pathname: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/local");
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
    form.append("file", blob, "foto.jpg");
    xhr.send(form);
  });
}

async function uploadBlob(blob: Blob, opts: UploadOptions): Promise<{ url: string; pathname: string }> {
  const { upload } = await import("@vercel/blob/client");
  const name = `${UPLOAD_PREFIX}foto.jpg`;
  const res = await upload(name, blob, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType: "image/jpeg",
    abortSignal: opts.signal,
    onUploadProgress: (p) => opts.onProgress?.(p.percentage / 100),
  });
  return { url: res.url, pathname: res.pathname };
}

/** Comprime (1600 px, JPEG 0.8) y sube una foto. Lanza Error con mensaje en español. */
export async function uploadPhoto(file: File, opts: UploadOptions): Promise<UploadedPhoto> {
  if (file.size === 0) throw new Error("El archivo está vacío.");
  const { blob, width, height } = await compressImage(file);
  const check = validateUpload("image/jpeg", blob.size);
  if (!check.ok) throw new Error(check.error);
  opts.onProgress?.(0);
  const stored = opts.mode === "blob" ? await uploadBlob(blob, opts) : await uploadLocal(blob, opts);
  opts.onProgress?.(1);
  return { ...stored, width, height, size: blob.size };
}

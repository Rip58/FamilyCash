/**
 * Compresión de fotos en el cliente: lado mayor 1600 px, JPEG 0.8.
 * La lógica de dimensiones es pura (testeada); el resto usa APIs del navegador.
 */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

export interface Dimensions {
  width: number;
  height: number;
}

/** Reduce manteniendo la proporción para que el lado mayor no pase de `max`. Nunca amplía. */
export function fitDimensions(width: number, height: number, max: number = MAX_SIDE): Dimensions {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface CompressedImage extends Dimensions {
  blob: Blob;
}

export class ImageDecodeError extends Error {
  constructor() {
    super("No se pudo leer la imagen. Prueba con otra foto (JPEG, PNG o WebP).");
  }
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // cae al <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageDecodeError();
  }
}

/** Decodifica (corrigiendo la orientación EXIF), reescala y devuelve un JPEG. */
export async function compressImage(file: File): Promise<CompressedImage> {
  const d = await decode(file);
  try {
    if (!d.width || !d.height) throw new ImageDecodeError();
    const { width, height } = fitDimensions(d.width, d.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageDecodeError();
    ctx.fillStyle = "#ffffff"; // PNG con transparencia -> fondo blanco
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(d.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new ImageDecodeError();
    return { blob, width, height };
  } finally {
    d.close();
  }
}

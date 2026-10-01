/**
 * Compresión de fotos en el cliente: WebP calidad 0,85, lado mayor 1600 px y como mucho
 * 300 KB (si pasa, baja la calidad hasta 0,6 y luego reduce el tamaño). Si el navegador no
 * sabe codificar WebP (Safari antiguo), usa JPEG con el mismo límite.
 * La lógica de dimensiones e intentos es pura (testeada); el resto usa APIs del navegador.
 */
export const MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.85;
export const MIN_QUALITY = 0.6;
export const MAX_PHOTO_BYTES = 300 * 1024;
/** Lado mayor mínimo al que se reduce para cumplir el límite de peso. */
export const MIN_SIDE = 800;

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

export interface Attempt {
  side: number;
  quality: number;
}

/**
 * Orden de intentos para no pasar de MAX_PHOTO_BYTES: primero bajar la calidad
 * (0,85 → 0,6 de 0,05 en 0,05) y, si no basta, reducir el lado mayor un 15 % y volver a empezar.
 */
export function compressionAttempts(longest: number, max: number = MAX_SIDE): Attempt[] {
  const out: Attempt[] = [];
  const start = Math.max(1, Math.min(max, Math.round(longest)));
  const min = Math.min(MIN_SIDE, start);
  for (let side = start; side >= min; side = Math.round(side * 0.85)) {
    for (let q = Math.round(PHOTO_QUALITY * 100); q >= Math.round(MIN_QUALITY * 100); q -= 5) {
      out.push({ side, quality: q / 100 });
    }
  }
  return out;
}

export interface CompressedImage extends Dimensions {
  blob: Blob;
  type: "image/webp" | "image/jpeg";
  quality: number;
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

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, type, quality));
}

/** Decodifica (corrigiendo la orientación EXIF), reescala y devuelve un WebP de ≤ 300 KB. */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  const d = await decode(file);
  try {
    if (!d.width || !d.height) throw new ImageDecodeError();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageDecodeError();
    let type: CompressedImage["type"] = "image/webp";
    let last: CompressedImage | null = null;
    let drawnSide = 0;
    for (const a of compressionAttempts(Math.max(d.width, d.height))) {
      const { width, height } = fitDimensions(d.width, d.height, a.side);
      if (a.side !== drawnSide) {
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#ffffff"; // PNG con transparencia -> fondo blanco
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(d.source, 0, 0, width, height);
        drawnSide = a.side;
      }
      let blob = await encode(canvas, type, a.quality);
      if (blob && blob.type !== type) {
        // El navegador no codifica WebP: seguimos en JPEG.
        type = "image/jpeg";
        blob = await encode(canvas, type, a.quality);
      }
      if (!blob) throw new ImageDecodeError();
      last = { blob, width, height, type, quality: a.quality };
      if (blob.size <= MAX_PHOTO_BYTES) return last;
    }
    if (!last) throw new ImageDecodeError();
    return last;
  } finally {
    d.close();
  }
}

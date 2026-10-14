// PDF del informe (solo cliente): 1.ª página = el informe (la misma imagen que se comparte) y después una página por
// nota con fotos: quién, las fotos y la nota DEBAJO, para que cada foto vaya con lo que se escribió.
import { buildImagePdf, type PdfImagePage } from "./pdf";
import { C, type Ctx, PAD, W, canvasBlob, font, renderReportCanvas, roundRect, wrap } from "./report-image";
import type { ShareModel } from "./report-share";

/** Una nota con sus fotos ya descargadas. */
export interface PdfPhotoNote {
  /** «Ana · Droguería», «General»… */
  who: string;
  /** «Incidencia», «Nota»… */
  label: string;
  /** «Martes 14 oct · 22:15». */
  when: string;
  text: string;
  photos: Blob[];
}

/** Alto máximo de una foto (px): una sola, grande; varias, algo menores para que la página no sea eterna. */
const MAX_PHOTO_H = 1500;
const MAX_PHOTO_H_MANY = 1100;
const JPEG_QUALITY = 0.85;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la foto"));
    };
    img.src = url;
  });
}

/** Página de una nota: cabecera, fotos una debajo de otra y el texto de la nota en una tarjeta. */
function paintNotePage(ctx: Ctx, n: PdfPhotoNote, imgs: HTMLImageElement[], draw: boolean): number {
  const inner = W - PAD * 2;
  let y = PAD;
  font(ctx, 40, 700);
  if (draw) {
    ctx.fillStyle = C.fg;
    ctx.fillText(n.who, PAD, y + 40);
  }
  y += 52;
  font(ctx, 28, 400);
  if (draw) {
    ctx.fillStyle = C.muted;
    ctx.fillText(`${n.label} · ${n.when}`, PAD, y + 30);
  }
  y += 56;
  for (const img of imgs) {
    const scale = Math.min(inner / img.naturalWidth, (imgs.length > 1 ? MAX_PHOTO_H_MANY : MAX_PHOTO_H) / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    if (draw) {
      ctx.save();
      roundRect(ctx, PAD + (inner - w) / 2, y, w, h, 20);
      ctx.clip();
      ctx.drawImage(img, PAD + (inner - w) / 2, y, w, h);
      ctx.restore();
    }
    y += h + 20;
  }
  font(ctx, 34, 400);
  const lines = n.text.split(/\n/).flatMap((p) => (p.trim() ? wrap(ctx, p, inner - 64) : [""]));
  const boxH = 48 + lines.length * 46;
  if (draw) {
    ctx.fillStyle = C.card;
    roundRect(ctx, PAD, y, inner, boxH, 24);
    ctx.fill();
    ctx.fillStyle = C.fg;
    lines.forEach((l, i) => ctx.fillText(l, PAD + 32, y + 24 + 34 + i * 46));
  }
  return y + boxH + PAD;
}

async function notePage(n: PdfPhotoNote): Promise<HTMLCanvasElement> {
  const imgs = (await Promise.all(n.photos.map((b) => loadImage(b).catch(() => null)))).filter((i): i is HTMLImageElement => !!i);
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas no disponible");
  const height = Math.ceil(paintNotePage(probe, n, imgs, false));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, height);
  paintNotePage(ctx, n, imgs, true);
  return canvas;
}

async function toPage(canvas: HTMLCanvasElement): Promise<PdfImagePage> {
  const blob = await canvasBlob(canvas, "image/jpeg", JPEG_QUALITY);
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** PDF: informe + una página por nota con fotos. */
export async function renderReportPdf(m: ShareModel, notes: PdfPhotoNote[], title: string): Promise<Blob> {
  const pages = [await toPage(renderReportCanvas(m))];
  for (const n of notes) pages.push(await toPage(await notePage(n)));
  return new Blob([buildImagePdf(pages, title) as BlobPart], { type: "application/pdf" });
}

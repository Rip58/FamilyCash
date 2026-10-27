// PDF del informe (solo cliente): 1.ª página = el informe (la misma imagen que se comparte) y después una página por
// FOTO: quién, la foto y la nota justo DEBAJO (si una nota tiene varias fotos, cada una lleva su texto debajo).
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
  /** Incidencia: su texto va en rojo. */
  incident?: boolean;
  photos: Blob[];
}

/** Alto máximo de la foto (px). */
const MAX_PHOTO_H = 1500;
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

/** Página de una foto: cabecera (quién · tipo · noche y «Foto 1 de 2»), la foto y el texto de su nota en una tarjeta. */
function paintPhotoPage(ctx: Ctx, n: PdfPhotoNote, img: HTMLImageElement | null, index: number, draw: boolean): number {
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
    ctx.fillStyle = n.incident ? C.red : C.muted;
    ctx.fillText(`${n.label} · ${n.when}${n.photos.length > 1 ? ` · Foto ${index + 1} de ${n.photos.length}` : ""}`, PAD, y + 30);
  }
  y += 56;
  if (img) {
    const scale = Math.min(inner / img.naturalWidth, MAX_PHOTO_H / img.naturalHeight);
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
    ctx.fillStyle = n.incident ? C.red : C.fg;
    lines.forEach((l, i) => ctx.fillText(l, PAD + 32, y + 24 + 34 + i * 46));
  }
  return y + boxH + PAD;
}

async function photoPage(n: PdfPhotoNote, index: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(n.photos[index]!).catch(() => null);
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas no disponible");
  const height = Math.ceil(paintPhotoPage(probe, n, img, index, false));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, height);
  paintPhotoPage(ctx, n, img, index, true);
  return canvas;
}

/** Una página ya pintada (JPEG), para la vista previa y para montar el PDF. */
export interface ReportPage {
  jpeg: Blob;
  width: number;
  height: number;
}

async function toPage(canvas: HTMLCanvasElement): Promise<ReportPage> {
  return { jpeg: await canvasBlob(canvas, "image/jpeg", JPEG_QUALITY), width: canvas.width, height: canvas.height };
}

/** Páginas del PDF: informe + una por foto, cada una con el texto de su nota debajo (en el orden de las notas). */
export async function renderReportPages(m: ShareModel, notes: PdfPhotoNote[]): Promise<ReportPage[]> {
  const pages = [await toPage(renderReportCanvas(m))];
  for (const n of notes) for (let i = 0; i < n.photos.length; i++) pages.push(await toPage(await photoPage(n, i)));
  return pages;
}

export async function pagesToPdf(pages: ReportPage[], title: string): Promise<Blob> {
  const list: PdfImagePage[] = await Promise.all(
    pages.map(async (p) => ({ jpeg: new Uint8Array(await p.jpeg.arrayBuffer()), width: p.width, height: p.height })),
  );
  return new Blob([buildImagePdf(list, title) as BlobPart], { type: "application/pdf" });
}

/** PDF: informe + una página por foto, cada una con el texto de su nota debajo (en el orden de las notas). */
export async function renderReportPdf(m: ShareModel, notes: PdfPhotoNote[], title: string): Promise<Blob> {
  return pagesToPdf(await renderReportPages(m, notes), title);
}

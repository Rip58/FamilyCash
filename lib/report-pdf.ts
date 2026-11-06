// PDF del informe (solo cliente), en hojas DIN A4 verticales dibujadas al doble de resolución: primero el informe (las
// hojas que hagan falta, cortadas entre bloques) y después una hoja por FOTO: quién, la foto y la nota justo DEBAJO (si
// una nota tiene varias fotos, cada una lleva su texto debajo).
import { buildImagePdf, type PdfImagePage } from "./pdf";
import { C, type Ctx, PAD, PAGE_H, W, canvasBlob, font, paintPageFooter, preloadSignatures, renderReportA4, reportPageCount, roundRect, wrap } from "./report-image";
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

/** Resolución de las hojas: 2 × (2160 × 3054 px por hoja) para que se pueda ampliar sin perder nitidez. */
const PDF_SCALE = 2;
/** Calidad JPEG de las hojas del PDF. */
const JPEG_QUALITY = 0.9;
/** Alto mínimo que se deja a la foto en su hoja (px lógicos); si la nota es muy larga, se recorta el texto. */
const MIN_PHOTO_H = 380;
/** Zona del pie de página (número de hoja). */
const FOOT = 64;

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

/**
 * Hoja A4 de una foto: cabecera (quién · tipo · noche y «Foto 1 de 2»), la foto lo más grande que quepa y justo debajo
 * el texto de su nota en una tarjeta.
 */
function paintPhotoPage(ctx: Ctx, n: PdfPhotoNote, img: HTMLImageElement | null, index: number): void {
  const inner = W - PAD * 2;
  let y = PAD;
  font(ctx, 40, 700);
  ctx.fillStyle = C.fg;
  ctx.fillText(n.who, PAD, y + 40);
  y += 52;
  font(ctx, 28, 400);
  ctx.fillStyle = n.incident ? C.red : C.muted;
  ctx.fillText(`${n.label} · ${n.when}${n.photos.length > 1 ? ` · Foto ${index + 1} de ${n.photos.length}` : ""}`, PAD, y + 30);
  y += 56;

  // El texto manda: se calcula antes y la foto ocupa lo que quede de la hoja.
  font(ctx, 34, 400);
  let lines = n.text.split(/\n/).flatMap((p) => (p.trim() ? wrap(ctx, p, inner - 64) : [""]));
  const maxLines = Math.floor((PAGE_H - y - PAD - FOOT - MIN_PHOTO_H - 20 - 48) / 46);
  if (lines.length > maxLines) lines = [...lines.slice(0, Math.max(1, maxLines - 1)), "…"];
  const boxH = 48 + lines.length * 46;

  const availH = PAGE_H - y - PAD - FOOT - boxH - 20;
  if (img) {
    const scale = Math.min(inner / img.naturalWidth, availH / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    ctx.save();
    roundRect(ctx, PAD + (inner - w) / 2, y, w, h, 20);
    ctx.clip();
    ctx.drawImage(img, PAD + (inner - w) / 2, y, w, h);
    ctx.restore();
    y += h + 20;
  } else {
    ctx.fillStyle = C.line;
    roundRect(ctx, PAD, y, inner, availH, 20);
    ctx.fill();
    font(ctx, 34, 600);
    ctx.fillStyle = C.muted;
    const label = "Foto no disponible";
    ctx.fillText(label, (W - ctx.measureText(label).width) / 2, y + availH / 2);
    y += availH + 20;
  }
  ctx.fillStyle = C.card;
  roundRect(ctx, PAD, y, inner, boxH, 24);
  ctx.fill();
  font(ctx, 34, 400);
  ctx.fillStyle = n.incident ? C.red : C.fg;
  lines.forEach((l, i) => ctx.fillText(l, PAD + 32, y + 24 + 34 + i * 46));
}

async function photoPage(n: PdfPhotoNote, index: number, label: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(n.photos[index]!).catch(() => null);
  const canvas = document.createElement("canvas");
  canvas.width = W * PDF_SCALE;
  canvas.height = PAGE_H * PDF_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.scale(PDF_SCALE, PDF_SCALE);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, PAGE_H);
  paintPhotoPage(ctx, n, img, index);
  paintPageFooter(ctx, label);
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

/**
 * Hojas A4 del PDF: el informe (las que hagan falta) + una por foto, cada una con el texto de su nota debajo (en el
 * orden de las notas). Todas numeradas «Página n de N».
 */
export async function renderReportPages(m: ShareModel, notes: PdfPhotoNote[]): Promise<ReportPage[]> {
  await preloadSignatures(m);
  const photoCount = notes.reduce((n, x) => n + x.photos.length, 0);
  const total = reportPageCount(m) + photoCount;
  const pages: ReportPage[] = [];
  for (const c of renderReportA4(m, PDF_SCALE, total)) pages.push(await toPage(c));
  let n = pages.length;
  for (const note of notes) {
    for (let i = 0; i < note.photos.length; i++) {
      n++;
      pages.push(await toPage(await photoPage(note, i, `${m.title} · Página ${n} de ${total}`)));
    }
  }
  return pages;
}

export async function pagesToPdf(pages: ReportPage[], title: string): Promise<Blob> {
  const list: PdfImagePage[] = await Promise.all(
    pages.map(async (p) => ({ jpeg: new Uint8Array(await p.jpeg.arrayBuffer()), width: p.width, height: p.height })),
  );
  return new Blob([buildImagePdf(list, title) as BlobPart], { type: "application/pdf" });
}

/** PDF en hojas A4: informe + una hoja por foto, cada una con el texto de su nota debajo (en el orden de las notas). */
export async function renderReportPdf(m: ShareModel, notes: PdfPhotoNote[], title: string): Promise<Blob> {
  return pagesToPdf(await renderReportPages(m, notes), title);
}

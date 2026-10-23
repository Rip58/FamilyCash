// PDF de vacaciones firmadas (solo cliente): 1.ª página = resumen de toda la plantilla; después una hoja por persona
// con sus fechas aprobadas, lo que descuenta y su firma (día y hora). Cada página es una imagen A4 (`buildImagePdf`).
import { buildImagePdf, type PdfImagePage } from "./pdf";
import { C, type Ctx, canvasBlob, font, roundRect, wrap } from "./report-image";
import { type VacationRange, rangeLabel, vacationSpan } from "./vacations";

/** Una persona en el PDF. */
export interface SignedSheet {
  name: string;
  department: string | null;
  /** Fechas firmadas (las de su última firma). */
  ranges: VacationRange[];
  /** PNG (data URL) de la firma, o null si aún no ha firmado. */
  signature: string | null;
  /** «Vie 2 feb · 10:05». */
  signedAt: string | null;
  /** Firmas que tiene en total. */
  signatures: number;
  /** Tiene cambios aprobados que aún no ha firmado (o falta que firme). */
  pending: boolean;
  /** Estado para el resumen: «Firmada», «Falta firmar», «En revisión», «Sin enviar». */
  state: string;
}

/** A4 a 150 ppp. */
const PW = 1240;
const PH = 1754;
const M = 96;
const JPEG_QUALITY = 0.9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la firma"));
    img.src = src;
  });
}

function page(): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement("canvas");
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PW, PH);
  return { canvas, ctx };
}

function header(ctx: Ctx, year: number, subtitle: string) {
  ctx.fillStyle = C.blue;
  ctx.fillRect(0, 0, PW, 14);
  font(ctx, 52, 800);
  ctx.fillStyle = C.fg;
  ctx.fillText(`Vacaciones ${year}`, M, M + 40);
  font(ctx, 28, 400);
  ctx.fillStyle = C.muted;
  ctx.fillText(subtitle, M, M + 86);
  ctx.fillStyle = C.line;
  ctx.fillRect(M, M + 112, PW - M * 2, 2);
}

function footer(ctx: Ctx, n: number, total: number, generated: string) {
  font(ctx, 22, 400);
  ctx.fillStyle = C.muted;
  ctx.fillText(`Generado el ${generated}`, M, PH - 56);
  const t = `Página ${n} de ${total}`;
  ctx.fillText(t, PW - M - ctx.measureText(t).width, PH - 56);
}

const STATE_COLOR: Record<string, [string, string]> = {
  Firmada: [C.green, C.greenBg],
  "Falta firmar": [C.amber, C.amberBg],
  "En revisión": [C.blue, C.blueBg],
  "Sin enviar": [C.muted, "#f2f2f7"],
};

/** Resumen: una fila por persona con sus fechas, lo que gasta y si ha firmado. */
function summaryPage(sheets: SignedSheet[], year: number, workDays: number) {
  const { canvas, ctx } = page();
  header(ctx, year, "Turno de noche · resumen de vacaciones firmadas");
  const signed = sheets.filter((s) => s.state === "Firmada").length;
  font(ctx, 30, 600);
  ctx.fillStyle = C.fg;
  ctx.fillText(`${signed} de ${sheets.length} firmadas`, M, M + 170);
  let y = M + 220;
  const colName = M;
  const colDates = M + 330;
  const colDays = PW - M - 330;
  const colState = PW - M - 190;
  font(ctx, 22, 600);
  ctx.fillStyle = C.muted;
  ctx.fillText("PERSONA", colName, y);
  ctx.fillText("FECHAS", colDates, y);
  ctx.fillText("DÍAS", colDays, y);
  ctx.fillText("ESTADO", colState, y);
  y += 18;
  for (const s of sheets) {
    font(ctx, 24, 400);
    const dates = s.ranges.length ? s.ranges.map(rangeLabel) : ["—"];
    const rowH = Math.max(1, dates.length) * 32 + 22;
    if (y + rowH > PH - 120) break; // una página de resumen (la plantilla cabe de sobra)
    ctx.fillStyle = C.line;
    ctx.fillRect(M, y, PW - M * 2, 1);
    y += 34;
    font(ctx, 26, 600);
    ctx.fillStyle = C.fg;
    ctx.fillText(fit(ctx, s.name, colDates - colName - 20), colName, y);
    font(ctx, 24, 400);
    dates.forEach((d, i) => ctx.fillText(d, colDates, y + i * 32));
    const used = s.ranges.reduce((n, r) => n + vacationSpan(r).counted, 0);
    ctx.fillText(s.ranges.length ? `${used}/${workDays}` : "—", colDays, y);
    const [fg, bg] = STATE_COLOR[s.state] ?? [C.muted, "#f2f2f7"];
    font(ctx, 20, 700);
    const w = ctx.measureText(s.state).width + 24;
    ctx.fillStyle = bg;
    roundRect(ctx, colState, y - 26, w, 36, 10);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(s.state, colState + 12, y - 1);
    y += (dates.length - 1) * 32 + 12;
  }
  return canvas;
}

function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Hoja de una persona: fechas aprobadas, días, frase de conformidad y firma. */
async function personPage(s: SignedSheet, year: number, workDays: number) {
  const { canvas, ctx } = page();
  header(ctx, year, "Turno de noche · hoja de vacaciones firmada");
  let y = M + 200;
  font(ctx, 46, 800);
  ctx.fillStyle = C.fg;
  ctx.fillText(s.name, M, y);
  y += 44;
  font(ctx, 28, 400);
  ctx.fillStyle = C.muted;
  ctx.fillText(s.department ?? "Sin departamento", M, y);

  // Tabla de periodos
  y += 70;
  const inner = PW - M * 2;
  const rows = s.ranges.length ? s.ranges : [];
  const tableH = 70 + Math.max(1, rows.length) * 64 + 72;
  ctx.fillStyle = "#f6f7f9";
  roundRect(ctx, M, y, inner, tableH, 24);
  ctx.fill();
  font(ctx, 22, 600);
  ctx.fillStyle = C.muted;
  ctx.fillText("PERIODO", M + 32, y + 50);
  ctx.fillText("DÍAS SEGUIDOS", M + 560, y + 50);
  ctx.fillText("DESCUENTA", M + 830, y + 50);
  let ry = y + 70;
  let used = 0;
  if (rows.length === 0) {
    font(ctx, 28, 400);
    ctx.fillStyle = C.muted;
    ctx.fillText("Sin vacaciones firmadas.", M + 32, ry + 42);
    ry += 64;
  }
  for (const r of rows) {
    const sp = vacationSpan(r);
    used += sp.counted;
    ctx.fillStyle = C.line;
    ctx.fillRect(M + 32, ry, inner - 64, 1);
    font(ctx, 30, 600);
    ctx.fillStyle = C.fg;
    ctx.fillText(rangeLabel(r), M + 32, ry + 44);
    font(ctx, 30, 400);
    ctx.fillText(`${sp.days.length} días`, M + 560, ry + 44);
    ctx.fillText(`${sp.counted} laborables`, M + 830, ry + 44);
    ry += 64;
  }
  ctx.fillStyle = C.line;
  ctx.fillRect(M + 32, ry, inner - 64, 2);
  font(ctx, 30, 700);
  ctx.fillStyle = C.fg;
  ctx.fillText(`Total: ${used} de ${workDays} días laborables`, M + 32, ry + 48);
  y += tableH + 60;

  // Conformidad
  font(ctx, 28, 400);
  ctx.fillStyle = C.fg;
  const text =
    `Con mi firma confirmo que estas son mis vacaciones de ${year}, aprobadas por el encargado del turno de noche. ` +
    "En cada semana, de lunes a viernes descuentan y mis 2 días de fiesta no.";
  for (const line of wrap(ctx, text, inner)) {
    ctx.fillText(line, M, y);
    y += 42;
  }

  // Firma
  y += 30;
  const boxH = 320;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  roundRect(ctx, M, y, inner, boxH, 24);
  ctx.stroke();
  if (s.signature) {
    try {
      const img = await loadImage(s.signature);
      const scale = Math.min((inner - 80) / img.naturalWidth, (boxH - 80) / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, M + (inner - w) / 2, y + (boxH - h) / 2, w, h);
    } catch {
      /* firma ilegible: queda el recuadro */
    }
  } else {
    font(ctx, 28, 400);
    ctx.fillStyle = C.muted;
    ctx.fillText("Sin firmar todavía", M + 40, y + boxH / 2);
  }
  y += boxH + 44;
  font(ctx, 26, 400);
  ctx.fillStyle = C.muted;
  ctx.fillText(
    s.signedAt ? `Firmado por ${s.name} el ${s.signedAt} · firma con el dedo en la app` : "Pendiente de firma",
    M,
    y,
  );
  if (s.signatures > 1) {
    y += 38;
    ctx.fillText(`Ha firmado ${s.signatures} veces (cada cambio aprobado se vuelve a firmar); esta es la última.`, M, y);
  }
  const note =
    s.state === "Falta firmar"
      ? "Ojo: tiene cambios aprobados que aún no ha firmado."
      : s.state === "En revisión"
        ? "Ojo: ha pedido cambios que aún están en revisión."
        : null;
  if (note && s.signedAt) {
    y += 60;
    ctx.fillStyle = C.amberBg;
    roundRect(ctx, M, y - 40, inner, 64, 16);
    ctx.fill();
    font(ctx, 26, 600);
    ctx.fillStyle = C.amber;
    ctx.fillText(note, M + 24, y + 2);
  }
  return canvas;
}

async function toPage(canvas: HTMLCanvasElement): Promise<PdfImagePage> {
  const blob = await canvasBlob(canvas, "image/jpeg", JPEG_QUALITY);
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** PDF: resumen (si hay más de una persona) + una hoja por cada persona que ha firmado. */
export async function renderVacationPdf(
  sheets: SignedSheet[],
  opts: { year: number; workDays: number; generated: string; title: string },
): Promise<{ pdf: Blob; pages: HTMLCanvasElement[] }> {
  const canvases: HTMLCanvasElement[] = [];
  if (sheets.length > 1) canvases.push(summaryPage(sheets, opts.year, opts.workDays));
  // Una hoja por persona que haya firmado (en el resumen salen todos); pedida para una sola persona, la suya.
  const people = sheets.length === 1 ? sheets : sheets.filter((s) => s.signature);
  for (const s of people) canvases.push(await personPage(s, opts.year, opts.workDays));
  canvases.forEach((c, i) => footer(c.getContext("2d")!, i + 1, canvases.length, opts.generated));
  const pages = await Promise.all(canvases.map(toPage));
  return { pdf: new Blob([buildImagePdf(pages, opts.title) as BlobPart], { type: "application/pdf" }), pages: canvases };
}

/**
 * PDF mínimo sin librerías: cada página es una imagen JPEG a toda página (informe, fotos con su nota…).
 * Ancho A4 (595 pt) y alto proporcional a la imagen. Puro (bytes): se usa en el cliente y en los tests.
 */
export interface PdfImagePage {
  /** Bytes de un JPEG (canvas.toBlob(…, "image/jpeg")). */
  jpeg: Uint8Array;
  /** Tamaño en píxeles. */
  width: number;
  height: number;
}

export const PDF_PAGE_WIDTH = 595.28;

const enc = new TextEncoder();
const num = (n: number) => (Math.round(n * 100) / 100).toString();

export function buildImagePdf(pages: PdfImagePage[], title?: string): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    size += bytes.length;
  };
  const obj = (id: number, body: string | (string | Uint8Array)[]) => {
    offsets[id] = size;
    push(`${id} 0 obj\n`);
    for (const p of Array.isArray(body) ? body : [body]) push(p);
    push("\nendobj\n");
  };

  // 1 catálogo, 2 páginas, 3 info; cada página usa 3 objetos: página, contenido e imagen.
  const pageId = (i: number) => 4 + i * 3;
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  obj(3, `<< /Title ${pdfString(title ?? "")} /Producer (FamilyCash) >>`);
  pages.forEach((p, i) => {
    const w = PDF_PAGE_WIDTH;
    const h = (PDF_PAGE_WIDTH * p.height) / p.width;
    const id = pageId(i);
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const content = `q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q`;
    obj(id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(id + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      "\nendstream",
    ]);
  });

  const count = pageId(pages.length);
  const xref = size;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Texto PDF en UTF-16BE (acentos en el título). */
function pdfString(s: string): string {
  let hex = "FEFF";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    const units = code > 0xffff ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)] : [code];
    for (const u of units) hex += u.toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

import { describe, expect, it } from "vitest";
import { buildImagePdf } from "@/lib/pdf";

const fakeJpeg = (n: number) => new Uint8Array(n).fill(0xff);
const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

describe("PDF de imágenes", () => {
  const pdf = latin1(buildImagePdf([{ jpeg: fakeJpeg(10), width: 1080, height: 2160 }, { jpeg: fakeJpeg(5), width: 1080, height: 1080 }], "Informe 14 oct"));
  it("una página por imagen, ancho A4 y alto proporcional", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("/MediaBox [0 0 595.28 1190.56]");
    expect(pdf).toContain("/MediaBox [0 0 595.28 595.28]");
    expect(pdf).toContain("/Filter /DCTDecode /Length 10");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });
  it("la tabla xref apunta al inicio de cada objeto", () => {
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = pdf.slice(xrefAt).split("\n").slice(3).filter((l) => / 00000 n $/.test(l));
    expect(entries).toHaveLength(9);
    entries.forEach((l, i) => expect(pdf.slice(Number(l.slice(0, 10)), Number(l.slice(0, 10)) + 8)).toBe(`${i + 1} 0 obj`.padEnd(8, "\n").slice(0, 8)));
  });
});

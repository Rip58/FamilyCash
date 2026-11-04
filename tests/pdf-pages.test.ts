import { describe, expect, it } from "vitest";
import { choosePageRanges } from "@/lib/pdf-pages";

describe("reparto del informe en hojas", () => {
  it("cabe en una hoja", () => {
    expect(choosePageRanges(1200, { major: [0, 300, 700], minor: [] }, 1400, 1400)).toEqual([[0, 1200]]);
  });
  it("corta entre tarjetas (la que no cabe pasa entera a la hoja siguiente)", () => {
    // Hoja 1000: tarjetas en 0, 400, 900 (la última mide 600 y no cabe en lo que queda) → corta en 900.
    expect(choosePageRanges(1500, { major: [0, 400, 900], minor: [] }, 1000, 1000)).toEqual([
      [0, 900],
      [900, 1500],
    ]);
  });
  it("una tarjeta más alta que una hoja se parte entre filas", () => {
    const r = choosePageRanges(3000, { major: [0, 200], minor: [300, 600, 900, 1200, 1500, 1800, 2100, 2400] }, 1000, 1000);
    expect(r[0]).toEqual([0, 900]);
    expect(r.every(([a, b]) => b > a)).toBe(true);
    expect(r.at(-1)![1]).toBe(3000);
  });
  it("sin puntos de corte, corta por el alto de la hoja", () => {
    expect(choosePageRanges(2500, { major: [], minor: [] }, 1000, 1000)).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 2500],
    ]);
  });
  it("no deja una hoja casi vacía al final", () => {
    expect(choosePageRanges(1050, { major: [0], minor: [] }, 1000, 1000)).toEqual([[0, 1050]]);
  });
});

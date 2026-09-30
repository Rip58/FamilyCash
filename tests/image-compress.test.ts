import { describe, expect, it } from "vitest";
import { MAX_SIDE, fitDimensions } from "@/lib/image-compress";

describe("fitDimensions", () => {
  it("no amplía imágenes pequeñas", () => {
    expect(fitDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitDimensions(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
  it("reduce el lado mayor a 1600 manteniendo la proporción", () => {
    expect(fitDimensions(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitDimensions(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitDimensions(3200, 3200)).toEqual({ width: 1600, height: 1600 });
  });
  it("respeta un máximo personalizado", () => {
    expect(fitDimensions(1000, 500, 500)).toEqual({ width: 500, height: 250 });
  });
  it("nunca devuelve 0 en un lado válido (panorámicas extremas)", () => {
    const r = fitDimensions(20000, 10);
    expect(r.width).toBe(MAX_SIDE);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
  it("dimensiones inválidas -> 0x0", () => {
    expect(fitDimensions(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitDimensions(NaN, 100)).toEqual({ width: 0, height: 0 });
  });
});

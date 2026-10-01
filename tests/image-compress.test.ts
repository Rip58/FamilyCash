import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  MAX_SIDE,
  MIN_QUALITY,
  MIN_SIDE,
  PHOTO_QUALITY,
  compressionAttempts,
  fitDimensions,
} from "@/lib/image-compress";

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

describe("compressionAttempts", () => {
  it("empieza en WebP 0,85 a 1600 px y baja la calidad hasta 0,6 antes de reducir", () => {
    const a = compressionAttempts(4032);
    expect(a[0]).toEqual({ side: 1600, quality: PHOTO_QUALITY });
    expect(a.slice(0, 6).map((x) => x.quality)).toEqual([0.85, 0.8, 0.75, 0.7, 0.65, 0.6]);
    expect(a[6]).toEqual({ side: 1360, quality: 0.85 });
  });
  it("nunca baja de MIN_QUALITY ni de MIN_SIDE", () => {
    const a = compressionAttempts(4032);
    expect(Math.min(...a.map((x) => x.quality))).toBe(MIN_QUALITY);
    expect(Math.min(...a.map((x) => x.side))).toBeGreaterThanOrEqual(MIN_SIDE);
  });
  it("con fotos pequeñas no amplía: parte del tamaño original", () => {
    const a = compressionAttempts(640);
    expect(a[0]?.side).toBe(640);
    expect(a.every((x) => x.side === 640)).toBe(true);
  });
  it("el límite de peso es 300 KB", () => {
    expect(MAX_PHOTO_BYTES).toBe(300 * 1024);
  });
});

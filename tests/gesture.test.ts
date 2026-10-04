import { describe, expect, it } from "vitest";
import { sheetDragOffset, shouldDismissSheet } from "@/lib/gesture";

describe("hojas: cerrar arrastrando", () => {
  it("por distancia, aunque sea despacio", () => {
    expect(shouldDismissSheet(120, 2000)).toBe(true);
    expect(shouldDismissSheet(80, 2000)).toBe(false);
  });
  it("por velocidad: un gesto rápido y corto también cierra", () => {
    expect(shouldDismissSheet(40, 200)).toBe(true); // 0,2 px/ms
    expect(shouldDismissSheet(40, 600)).toBe(false); // 0,067 px/ms
    expect(shouldDismissSheet(8, 10)).toBe(false); // un toque no cierra
  });
  it("hacia arriba ofrece resistencia (máx. ~24 px), hacia abajo sigue al dedo", () => {
    expect(sheetDragOffset(50)).toBe(50);
    expect(sheetDragOffset(-30)).toBeLessThan(0);
    expect(sheetDragOffset(-1000)).toBeGreaterThan(-24.01);
    expect(Math.abs(sheetDragOffset(-30))).toBeLessThan(30);
  });
});

import { describe, expect, it } from "vitest";
import { palletsDone, parsePallets } from "@/lib/aisle-format";

describe("palés del pasillo", () => {
  it("hechos = subidos − bajados", () => {
    expect(palletsDone(12, 2)).toBe(10);
    expect(palletsDone(12, null)).toBe(12);
    expect(palletsDone(3, 5)).toBe(0);
    expect(palletsDone(null, 2)).toBeNull();
  });
  it("si los bajados son sobrante, cuentan como hechos", () => {
    expect(palletsDone(12, 2, true)).toBe(12);
    expect(palletsDone(null, 2, true)).toBeNull();
  });
  it("lee el campo numérico", () => {
    expect(parsePallets("")).toBeNull();
    expect(parsePallets(" 14 ")).toBe(14);
    expect(parsePallets("-1")).toBeNull();
    expect(parsePallets("1.5")).toBeNull();
    expect(parsePallets("0")).toBe(0);
  });
});

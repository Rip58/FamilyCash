import { describe, expect, it } from "vitest";
import { IDLE_RESET_MS, idleExceeded } from "@/lib/idle-reset";

describe("idleExceeded", () => {
  it("no recarga si vuelve pronto", () => {
    expect(idleExceeded(1000, 1000 + 60_000)).toBe(false);
    expect(idleExceeded(1000, 1000 + IDLE_RESET_MS)).toBe(false);
  });
  it("recarga si pasa del límite", () => {
    expect(idleExceeded(1000, 1000 + IDLE_RESET_MS + 1)).toBe(true);
    expect(idleExceeded(1000, 1000 + 2 * 3_600_000)).toBe(true);
  });
  it("sin referencia no recarga", () => {
    expect(idleExceeded(0, 10_000_000)).toBe(false);
  });
});

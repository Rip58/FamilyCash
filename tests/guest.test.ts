import { describe, expect, it } from "vitest";
import { GUEST_TOKEN_RE, guestNight, sameToken, secondsUntilGuestEnd } from "@/lib/guest";

// Octubre 2026: Madrid = UTC+2.
const at = (iso: string) => new Date(iso);

describe("enlace del compañero: noche en curso hasta las 09:30", () => {
  it("el jueves por la tarde y por la noche es la noche del jueves", () => {
    expect(guestNight(at("2026-10-15T10:00:00+02:00"))).toBe("2026-10-15");
    expect(guestNight(at("2026-10-15T23:30:00+02:00"))).toBe("2026-10-15");
  });
  it("el viernes de madrugada y hasta las 09:29 sigue siendo la del jueves; a las 09:30 ya es la del viernes", () => {
    expect(guestNight(at("2026-10-16T03:00:00+02:00"))).toBe("2026-10-15");
    expect(guestNight(at("2026-10-16T09:29:00+02:00"))).toBe("2026-10-15");
    expect(guestNight(at("2026-10-16T09:30:00+02:00"))).toBe("2026-10-16");
  });
  it("la cookie dura hasta la próxima 09:30", () => {
    expect(secondsUntilGuestEnd(at("2026-10-16T09:00:00+02:00"))).toBe(30 * 60);
    expect(secondsUntilGuestEnd(at("2026-10-15T21:30:00+02:00"))).toBe(12 * 3600);
  });
  it("compara códigos", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken(null, "abc")).toBe(false);
    expect(GUEST_TOKEN_RE.test("a".repeat(32))).toBe(true);
    expect(GUEST_TOKEN_RE.test("a/b")).toBe(false);
  });
});

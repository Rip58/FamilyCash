import { describe, expect, it } from "vitest";
import { GUEST_PIN_RE, afterWrongPin, guestNight, sameToken, secondsUntilGuestEnd } from "@/lib/guest";

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
  });
});

describe("PIN del compañero", () => {
  const now = new Date("2026-10-15T22:00:00+02:00");
  it("4 dígitos", () => {
    expect(GUEST_PIN_RE.test("0427")).toBe(true);
    expect(GUEST_PIN_RE.test("427")).toBe(false);
    expect(GUEST_PIN_RE.test("04a7")).toBe(false);
  });
  it("cada 5 fallos seguidos, 15 min de bloqueo; a los 20 se apaga", () => {
    expect(afterWrongPin(0, now)).toEqual({ fails: 1, lockedUntil: null, disable: false });
    expect(afterWrongPin(4, now).lockedUntil?.toISOString()).toBe("2026-10-15T20:15:00.000Z");
    expect(afterWrongPin(5, now).lockedUntil).toBeNull();
    expect(afterWrongPin(19, now).disable).toBe(true);
  });
});

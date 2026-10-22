import { describe, expect, it } from "vitest";
import { isTrivialPin, maxAtOnce, parseDepartmentMax, pickPin, vacationInvite, weekLabel } from "@/lib/vacations";

describe("PIN de vacaciones", () => {
  it("descarta los fáciles", () => {
    for (const p of ["0000", "1111", "1234", "4321", "6789", "123", "12a4"]) expect(isTrivialPin(p)).toBe(true);
    for (const p of ["4821", "1357", "0912"]) expect(isTrivialPin(p)).toBe(false);
  });
  it("nunca repite uno ya dado", () => {
    const taken = new Set(["4821"]);
    let n = 0;
    const seq = [0.4821, 0.4821, 0.1111, 0.5309];
    expect(pickPin(taken, () => seq[n++ % seq.length]!)).toBe("5309");
  });
  it("encuentra hueco aunque el azar falle", () => {
    const taken = new Set(Array.from({ length: 9000 }, (_, i) => String(i).padStart(4, "0")));
    const pin = pickPin(taken, () => 0);
    expect(taken.has(pin)).toBe(false);
    expect(isTrivialPin(pin)).toBe(false);
  });
});

describe("máximo a la vez", () => {
  const c = { defaultMax: 2, departmentMax: { drog: 1 } };
  it("por departamento, con el general para el resto", () => {
    expect(maxAtOnce(c, "drog")).toBe(1);
    expect(maxAtOnce(c, "bot")).toBe(2);
    expect(maxAtOnce(c, null)).toBe(2);
  });
  it("una semana con su propio máximo manda", () => {
    expect(maxAtOnce(c, "drog", { maxOverride: 3 })).toBe(3);
    expect(maxAtOnce(c, "drog", { maxOverride: null })).toBe(1);
  });
  it("lee el JSON de la BD sin fiarse", () => {
    expect(parseDepartmentMax({ a: 1, b: "2", c: -1, d: 1.5 })).toEqual({ a: 1 });
    expect(parseDepartmentMax(null)).toEqual({});
  });
});

describe("textos", () => {
  it("semana con su número y fechas", () => {
    expect(weekLabel("2027-07-26")).toBe("S30 · 26 jul – 1 ago");
  });
  it("mensaje para WhatsApp con enlace, PIN y plazo", () => {
    expect(vacationInvite("Cintya Sanchez", "https://x.app/vacaciones", "4821", { year: 2027, deadline: "2027-01-30" })).toBe(
      "Hola Cintya: elige tus vacaciones de 2027 aquí https://x.app/vacaciones con tu PIN 4821. Tienes hasta el 30/1/2027.",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  clampOvertime, delayBalance, formatOvertime, isValidOvertime, proposeOvertime, sumOvertimeByEmployee, totalOvertime,
} from "@/lib/overtime";

const shift = { shiftStart: "21:30", shiftEnd: "06:30" };

describe("formatOvertime", () => {
  it("formatea minutos, horas y combinados", () => {
    expect(formatOvertime(45)).toBe("45 min");
    expect(formatOvertime(60)).toBe("1 h");
    expect(formatOvertime(90)).toBe("1 h 30 min");
    expect(formatOvertime(60, true)).toBe("+1 h");
    expect(formatOvertime(15, true)).toBe("+15 min");
    expect(formatOvertime(0)).toBe("0 min");
  });
  it("negativo = retraso, con signo menos", () => {
    expect(formatOvertime(-30)).toBe("−30 min");
    expect(formatOvertime(-90, true)).toBe("−1 h 30 min");
  });
});

describe("clamp / validación", () => {
  it("ajusta a múltiplos de 15 entre −480 (retraso) y 720", () => {
    expect(clampOvertime(-15)).toBe(-15);
    expect(clampOvertime(-1000)).toBe(-480);
    expect(Object.is(clampOvertime(-5), 0)).toBe(true);
    expect(clampOvertime(20)).toBe(15);
    expect(clampOvertime(2000)).toBe(720);
  });
  it("valida rango y paso", () => {
    expect(isValidOvertime(0)).toBe(true);
    expect(isValidOvertime(720)).toBe(true);
    expect(isValidOvertime(735)).toBe(false);
    expect(isValidOvertime(20)).toBe(false);
    expect(isValidOvertime(-15)).toBe(true);
    expect(isValidOvertime(-480)).toBe(true);
    expect(isValidOvertime(-495)).toBe(false);
    expect(isValidOvertime(7.5)).toBe(false);
  });
});

describe("proposeOvertime", () => {
  it("propone la diferencia tras el fin de turno, redondeada a 15", () => {
    expect(proposeOvertime("07:30", shift)).toBe(60);
    expect(proposeOvertime("06:50", shift)).toBe(15); // 20 -> 15
    expect(proposeOvertime("07:00", shift)).toBe(30);
  });
  it("no propone si sale a su hora, antes o no hay hora", () => {
    expect(proposeOvertime("06:30", shift)).toBeNull();
    expect(proposeOvertime("04:00", shift)).toBeNull();
    expect(proposeOvertime("06:35", shift)).toBeNull(); // redondea a 0
    expect(proposeOvertime(null, shift)).toBeNull();
    expect(proposeOvertime("21:00", shift)).toBeNull(); // antes de empezar
  });
  it("cruza medianoche con otros turnos", () => {
    expect(proposeOvertime("00:45", { shiftStart: "16:00", shiftEnd: "00:00" })).toBe(45);
  });
});

describe("sumas", () => {
  const items = [
    { employeeId: "a", extraMinutes: 60 },
    { employeeId: "a", extraMinutes: 30 },
    { employeeId: "b", extraMinutes: null },
    { employeeId: "c" },
    { employeeId: "d", extraMinutes: 15 },
  ];
  it("total y por empleado", () => {
    expect(totalOvertime(items)).toBe(105);
    expect([...sumOvertimeByEmployee(items)]).toEqual([["a", 90], ["d", 15]]);
  });
});

describe("retrasos", () => {
  it("los totales son netos: el retraso resta", () => {
    expect(totalOvertime([{ extraMinutes: 60 }, { extraMinutes: -30 }, { extraMinutes: null }])).toBe(30);
    expect(sumOvertimeByEmployee([{ employeeId: "a", extraMinutes: -30 }]).get("a")).toBe(-30);
  });
});

describe("recuperar retrasos (delayBalance)", () => {
  it("un retraso de 30 min se recupera con 30 min otro día", () => {
    const b = delayBalance([
      { date: "2026-10-13", extraMinutes: -30 },
      { date: "2026-10-15", extraMinutes: 30, extraRecovers: true },
    ]);
    expect(b.owed).toBe(0);
    expect(b.recoveredFor.get("2026-10-15")).toEqual(["2026-10-13"]);
  });
  it("paga primero el más antiguo y deja el resto pendiente", () => {
    const b = delayBalance([
      { date: "2026-10-14", extraMinutes: -15 },
      { date: "2026-10-12", extraMinutes: -30 },
      { date: "2026-10-16", extraMinutes: 30, extraRecovers: true },
    ]);
    expect(b.owed).toBe(15);
    expect(b.pending).toEqual([{ date: "2026-10-14", minutes: 15 }]);
  });
  it("las horas extra normales no recuperan", () => {
    const b = delayBalance([
      { date: "2026-10-13", extraMinutes: -30 },
      { date: "2026-10-15", extraMinutes: 60 },
    ]);
    expect(b.owed).toBe(30);
  });
});

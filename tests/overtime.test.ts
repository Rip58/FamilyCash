import { describe, expect, it } from "vitest";
import {
  clampOvertime, formatOvertime, isValidOvertime, proposeOvertime, sumOvertimeByEmployee, totalOvertime,
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
});

describe("clamp / validación", () => {
  it("ajusta a múltiplos de 15 entre 0 y 720", () => {
    expect(clampOvertime(-15)).toBe(0);
    expect(clampOvertime(20)).toBe(15);
    expect(clampOvertime(2000)).toBe(720);
  });
  it("valida rango y paso", () => {
    expect(isValidOvertime(0)).toBe(true);
    expect(isValidOvertime(720)).toBe(true);
    expect(isValidOvertime(735)).toBe(false);
    expect(isValidOvertime(20)).toBe(false);
    expect(isValidOvertime(-15)).toBe(false);
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

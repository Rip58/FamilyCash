import { describe, expect, it } from "vitest";
import {
  addDays, formatDayLong, formatDayShort, formatWeekRange, fromDbDate, isDateStr, isoWeekNumber,
  madridParts, operationalToday, toDbDate, weekDays, weekStart, weekdayIndex, weekdayLetter,
} from "@/lib/dates";

describe("operationalToday", () => {
  it("antes de las 12:00 devuelve ayer", () => {
    // 2026-09-29 11:59 CEST = 09:59Z
    expect(operationalToday(new Date("2026-09-29T09:59:00Z"), 12)).toBe("2026-09-28");
  });
  it("a partir de las 12:00 devuelve hoy", () => {
    expect(operationalToday(new Date("2026-09-29T10:00:00Z"), 12)).toBe("2026-09-29");
  });
  it("usa la fecha de Madrid, no la UTC (23:30 UTC ya es el día siguiente)", () => {
    // 2026-09-29 23:30Z = 30 sep 01:30 CEST -> antes de 12 -> 29
    expect(operationalToday(new Date("2026-09-29T23:30:00Z"), 12)).toBe("2026-09-29");
  });
  it("respeta un rollover distinto", () => {
    expect(operationalToday(new Date("2026-09-29T03:00:00Z"), 6)).toBe("2026-09-28"); // 05:00 < 6
    expect(operationalToday(new Date("2026-09-29T04:00:00Z"), 6)).toBe("2026-09-29"); // 06:00
  });
  it("cruce de año", () => {
    // 1 ene 2027 08:00 CET = 07:00Z -> ayer = 31 dic 2026
    expect(operationalToday(new Date("2027-01-01T07:00:00Z"), 12)).toBe("2026-12-31");
    expect(operationalToday(new Date("2027-01-01T11:00:00Z"), 12)).toBe("2027-01-01");
  });
  it("cambio de hora de primavera (29 mar 2026, CET->CEST)", () => {
    expect(operationalToday(new Date("2026-03-29T09:59:59Z"), 12)).toBe("2026-03-28"); // 11:59:59 CEST
    expect(operationalToday(new Date("2026-03-29T10:00:00Z"), 12)).toBe("2026-03-29"); // 12:00 CEST
  });
  it("cambio de hora de otoño (25 oct 2026, CEST->CET)", () => {
    expect(operationalToday(new Date("2026-10-25T10:59:59Z"), 12)).toBe("2026-10-24"); // 11:59:59 CET
    expect(operationalToday(new Date("2026-10-25T11:00:00Z"), 12)).toBe("2026-10-25"); // 12:00 CET
  });
  it("madridParts en el día de 25 h", () => {
    expect(madridParts(new Date("2026-10-25T00:30:00Z"))).toEqual({ date: "2026-10-25", hour: 2, minute: 30 });
    expect(madridParts(new Date("2026-10-25T01:30:00Z"))).toEqual({ date: "2026-10-25", hour: 2, minute: 30 });
  });
});

describe("semanas", () => {
  it("weekStart devuelve el lunes", () => {
    expect(weekStart("2026-09-29")).toBe("2026-09-28"); // martes
    expect(weekStart("2026-09-28")).toBe("2026-09-28"); // lunes
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // domingo
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // cruce de año
  });
  it("weekdayIndex 0=Lun … 6=Dom", () => {
    expect(weekdayIndex("2026-09-28")).toBe(0);
    expect(weekdayIndex("2026-10-04")).toBe(6);
  });
  it("weekDays da 7 días consecutivos", () => {
    const d = weekDays("2026-10-28");
    expect(d).toHaveLength(7);
    expect(d[0]).toBe("2026-10-26");
    expect(d[6]).toBe("2026-11-01");
  });
  it("addDays atraviesa cambios de hora y de año", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("semana ISO", () => {
    expect(isoWeekNumber("2026-09-29")).toBe(40);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(isoWeekNumber("2027-01-01")).toBe(53); // pertenece a 2026-W53
    expect(isoWeekNumber("2024-12-30")).toBe(1); // 2025-W01
  });
});

describe("formato", () => {
  it("día largo y corto en español", () => {
    expect(formatDayLong("2026-09-28")).toBe("Lunes 28 sep");
    expect(formatDayShort("2026-09-28")).toBe("Lun 28");
    expect(weekdayLetter("2026-09-30")).toBe("X");
  });
  it("rango de semana", () => {
    expect(formatWeekRange("2026-09-29")).toBe("28 sep – 4 oct");
  });
});

describe("Date <-> string", () => {
  it("ida y vuelta sin desfase", () => {
    for (const d of ["2026-03-29", "2026-10-25", "2026-12-31", "2027-01-01"]) {
      const dt = toDbDate(d);
      expect(dt.toISOString()).toBe(`${d}T00:00:00.000Z`);
      expect(fromDbDate(dt)).toBe(d);
    }
  });
  it("validación", () => {
    expect(isDateStr("2026-02-29")).toBe(false);
    expect(isDateStr("2026-13-01")).toBe(false);
    expect(isDateStr("2026-9-1")).toBe(false);
    expect(isDateStr("2028-02-29")).toBe(true);
  });
});

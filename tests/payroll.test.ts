import { describe, expect, it } from "vitest";
import { addMonths, isMonthStr, monthDays, monthOf } from "@/lib/dates";
import {
  DEFAULT_PAYROLL, type MonthStats, calculatePay, configForMonth, mergeStats, monthStatsFromSchedule, parseEuros,
  periodForMonth, weeklyExtraToMonthlyMinutes,
} from "@/lib/payroll";
import type { DayEntryLite, EmployeeLite, StatusTypeLite } from "@/lib/schedule";

const st = (code: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: code, code, label: code, color: "#000", isWorking, sortOrder,
});
const statusTypes = [st("WORK", true, 0), st("OFF", false, 1), st("PAID_OFF", false, 2), st("SICK", false, 3), st("VACATION", false, 4), st("ABSENT", false, 5)];
const me: EmployeeLite = { id: "me", name: "Yo", defaultDepartmentId: null, sortOrder: 0, fixedDaysOff: [5, 6], active: true };
const entry = (date: string, statusTypeId: string, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId: "me", date, statusTypeId, departmentId: null, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});

describe("meses", () => {
  it("helpers", () => {
    expect(isMonthStr("2026-09")).toBe(true);
    expect(isMonthStr("2026-13")).toBe(false);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthOf("2026-09-30")).toBe("2026-09");
  });
});

describe("resumen del mes desde el cuadrante", () => {
  it("cuenta días por tipo y suma horas extra", () => {
    // Sept 2026: 30 días; sábados y domingos (fijos) = 8
    const s = monthStatsFromSchedule("2026-09", me, [
      entry("2026-09-01", "WORK", { extraMinutes: 60 }),
      entry("2026-09-02", "VACATION"),
      entry("2026-09-03", "ABSENT"),
      entry("2026-09-04", "SICK"),
      entry("2026-09-07", "WORK", { extraMinutes: 30 }),
    ], statusTypes);
    expect(s).toEqual({
      daysInMonth: 30, daysWorked: 19, daysOff: 8, vacationDays: 1, sickDays: 1, absentDays: 1,
      holidaysWorked: 0, extraMinutes: 90,
    });
  });
  it("los valores a mano sustituyen a los automáticos", () => {
    const auto: MonthStats = { daysInMonth: 30, daysWorked: 20, daysOff: 8, vacationDays: 2, sickDays: 0, absentDays: 0, holidaysWorked: 0, extraMinutes: 0 };
    expect(mergeStats(auto, { daysWorked: 21, extraMinutes: null }).daysWorked).toBe(21);
    expect(mergeStats(auto, { daysWorked: 21, extraMinutes: null }).extraMinutes).toBe(0);
  });
});

describe("calculadora", () => {
  const cfg = { ...DEFAULT_PAYROLL, baseMonthlyCents: 150000, overtimeHourCents: 1500, holidayWorkedCents: 4000, ssPercent: 6.5, irpfPercent: 10 };
  const stats: MonthStats = { daysInMonth: 30, daysWorked: 22, daysOff: 8, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 1, extraMinutes: 120 };

  it("turno de noche con plus en %", () => {
    const r = calculatePay(cfg, stats, "NIGHT");
    // base 1500 + noche 25% (375) + extra 2h*15 (30) + festivo 40 = 1945
    expect(r.grossCents).toBe(194500);
    expect(r.deductions.map((d) => d.cents)).toEqual([12643, 19450]);
    expect(r.netCents).toBe(194500 - 12643 - 19450);
  });
  it("turno de día sin plus de noche", () => {
    const r = calculatePay(cfg, stats, "DAY");
    expect(r.earnings.some((l) => l.key === "night")).toBe(false);
    expect(r.grossCents).toBe(157000);
  });
  it("plus por noche y descuento de faltas", () => {
    const r = calculatePay(
      { ...cfg, nightPlusMode: "PER_NIGHT", nightPlusPerNightCents: 1000 },
      { ...stats, daysWorked: 21, absentDays: 1, extraMinutes: 0, holidaysWorked: 0 },
      "NIGHT",
    );
    expect(r.earnings.find((l) => l.key === "night")!.cents).toBe(21000);
    expect(r.earnings.find((l) => l.key === "absent")!.cents).toBe(-5000);
    expect(r.grossCents).toBe(150000 - 5000 + 21000);
  });
});

describe("parseEuros", () => {
  it("acepta formatos españoles", () => {
    expect(parseEuros("1.234,56")).toBe(123456);
    expect(parseEuros("1234.5")).toBe(123450);
    expect(parseEuros("1.500")).toBe(150000);
    expect(parseEuros("12,5 €")).toBe(1250);
    expect(parseEuros("")).toBe(0);
    expect(parseEuros("abc")).toBeNull();
  });
});

describe("periodos y propuesta salarial", () => {
  const periods = [
    { id: "a", from: "2026-09-21", to: "2026-11-30", baseCents: 186007, respPlusCents: 0 },
    { id: "b", from: "2026-12-01", to: "2027-03-31", baseCents: 186007, respPlusCents: 50000 },
    { id: "c", from: "2027-04-01", to: "2027-09-30", baseCents: 186007, respPlusCents: 95000 },
    { id: "d", from: "2027-10-01", to: null, baseCents: 186007, respPlusCents: 129361 },
  ];
  const cfg = { ...DEFAULT_PAYROLL, nightPlusPercent: 0, overtimeHourCents: 1374, ssPercent: 6.5, irpfPercent: 0 };
  const stats: MonthStats = { daysInMonth: 31, daysWorked: 23, daysOff: 8, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 0, extraMinutes: 0 };
  const net = (month: string, extraMinutes = 0) =>
    calculatePay(configForMonth(cfg, periods, month), { ...stats, extraMinutes }, "NIGHT");

  it("elige el periodo del mes", () => {
    expect(periodForMonth(periods, "2026-08")).toBeNull();
    expect(periodForMonth(periods, "2026-09")!.id).toBe("a");
    expect(periodForMonth(periods, "2027-01")!.id).toBe("b");
    expect(periodForMonth(periods, "2030-01")!.id).toBe("d");
  });
  it("cuadra con la propuesta (40 h)", () => {
    expect(net("2026-10").netCents).toBe(173917);
    expect(net("2027-01").netCents).toBe(220667);
    expect(net("2027-05").netCents).toBe(262742);
    expect(net("2027-11").netCents).toBe(294869);
  });
  it("jornada 48 h ≈ propuesta (±0,10 €)", () => {
    const m48 = weeklyExtraToMonthlyMinutes(8);
    expect(m48).toBe(2080);
    expect(Math.abs(net("2026-10", m48).grossCents - 233647)).toBeLessThanOrEqual(10);
    expect(Math.abs(net("2027-11", m48).netCents - 339412)).toBeLessThanOrEqual(10);
  });
});

import { describe, expect, it } from "vitest";
import { addMonths, isMonthStr, monthDays, monthOf, payMonthOf, payPeriodDays } from "@/lib/dates";
import {
  DEFAULT_PAYROLL, type MonthStats, calculatePay, configForMonth, mergeStats, monthProgress, monthStatsFromSchedule, parseEuros, projectMonth,
  andorraIrpfAnnualCents, offDayOvertimeMinutes, overtimeRateCents, periodForMonth,
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
      holidaysWorked: 0, offDaysWorked: 0, extraMinutes: 90,
    });
  });
  it("los días trabajados se deducen de los demás", () => {
    const auto: MonthStats = { daysInMonth: 30, daysWorked: 20, daysOff: 8, vacationDays: 2, sickDays: 0, absentDays: 0, holidaysWorked: 0, offDaysWorked: 0, extraMinutes: 0 };
    // 1 día de fiesta a la semana = 4 al mes, sin nada más → 26 trabajados
    const m = mergeStats(auto, { daysOff: 4, vacationDays: 0, extraMinutes: null });
    expect(m.daysWorked).toBe(26);
    expect(m.extraMinutes).toBe(0);
    // mes parcial: 11 días de contrato, 1 de fiesta → 10
    const first = mergeStats(auto, { contractDays: 11, daysOff: 1, vacationDays: 0 });
    expect(first).toMatchObject({ contractDays: 11, daysWorked: 10 });
  });
});

describe("calculadora", () => {
  const cfg = { ...DEFAULT_PAYROLL, baseMonthlyCents: 150000, overtimeMode: "FIXED" as const, overtimeHourCents: 1500, holidayWorkedCents: 4000, ssPercent: 6.5, irpfPercent: 10 };
  // 4 semanas exactas: 20 noches = 160 h = 40 h/semana → sin horas extra por fiestas
  const stats: MonthStats = { daysInMonth: 28, daysWorked: 20, daysOff: 8, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 1, offDaysWorked: 0, extraMinutes: 120 };

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
      { ...stats, daysWorked: 19, absentDays: 1, extraMinutes: 0, holidaysWorked: 0 },
      "NIGHT",
    );
    expect(r.earnings.find((l) => l.key === "night")!.cents).toBe(19000);
    expect(r.earnings.find((l) => l.key === "absent")!.cents).toBe(-5000);
    expect(r.grossCents).toBe(150000 - 5000 + 19000);
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
    { id: "a", from: "2026-09-21", to: "2026-11-30", baseCents: 156867, respPlusCents: 0 },
    { id: "b", from: "2026-12-01", to: "2027-03-31", baseCents: 156867, respPlusCents: 50000 },
    { id: "c", from: "2027-04-01", to: "2027-09-30", baseCents: 156867, respPlusCents: 95000 },
    { id: "d", from: "2027-10-01", to: null, baseCents: 156867, respPlusCents: 129361 },
  ];
  const cfg = { ...DEFAULT_PAYROLL, nightPlusPercent: 18.5762, overtimeMode: "FIXED" as const, overtimeHourCents: 1374, ssPercent: 6.5, irpfPercent: 0 };
  const stats: MonthStats = { daysInMonth: 28, daysWorked: 20, daysOff: 8, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 0, offDaysWorked: 0, extraMinutes: 0 };
  const net = (month: string, extraMinutes = 0) =>
    calculatePay(configForMonth(cfg, periods, month), { ...stats, extraMinutes }, "NIGHT");

  it("elige el periodo del mes", () => {
    expect(periodForMonth(periods, "2026-08")).toBeNull();
    expect(periodForMonth(periods, "2026-09")!.id).toBe("a");
    expect(periodForMonth(periods, "2027-01")!.id).toBe("b");
    expect(periodForMonth(periods, "2030-01")!.id).toBe("d");
  });
  it("salario mínimo + plus de noche = bruto de la propuesta; de día, sin plus", () => {
    expect(net("2026-10").grossCents).toBe(186007);
    expect(calculatePay(configForMonth(cfg, periods, "2026-10"), stats, "DAY").grossCents).toBe(156867);
  });
  it("cuadra con la propuesta (40 h)", () => {
    expect(net("2026-10").netCents).toBe(173917);
    expect(net("2027-01").netCents).toBe(220667);
    expect(net("2027-05").netCents).toBe(262742);
    expect(net("2027-11").netCents).toBe(294869);
  });
});

describe("Andorra: horas extra por ley, mes parcial e IRPF", () => {
  const law = { ...DEFAULT_PAYROLL, baseMonthlyCents: 156867, nightPlusPercent: 18.5762, ssPercent: 6.5, irpfPercent: 0 };

  it("hora extra = fijo/h × 1,40 (+ nocturnidad/h de noche)", () => {
    expect(Math.round(overtimeRateCents(law, "DAY"))).toBe(1267); // 9,05 × 1,4
    expect(Math.round(overtimeRateCents(law, "NIGHT"))).toBe(1435); // + 1,68 €/h
    expect(overtimeRateCents({ ...law, overtimeMode: "FIXED", overtimeHourCents: 1374 }, "NIGHT")).toBe(1374);
  });

  it("mes completo: sueldo fijo sea de 28 o 31 días; cada fiesta trabajada = 8 h extra", () => {
    const base: MonthStats = { daysInMonth: 28, daysWorked: 20, daysOff: 8, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 0, offDaysWorked: 0, extraMinutes: 0 };
    const feb = calculatePay(law, base, "NIGHT");
    const aug = calculatePay(law, { ...base, daysInMonth: 31, daysWorked: 22, daysOff: 9 }, "NIGHT");
    expect(feb.grossCents).toBe(186007);
    expect(aug.grossCents).toBe(186007);
    const two = calculatePay(law, { ...base, offDaysWorked: 2 }, "NIGHT");
    expect(offDayOvertimeMinutes({ ...base, offDaysWorked: 2 })).toBe(16 * 60);
    expect(two.grossCents - feb.grossCents).toBe(Math.round(16 * overtimeRateCents(law, "NIGHT")));
  });

  it("vacaciones reducen el plus de noche, no el sueldo", () => {
    const m: MonthStats = { daysInMonth: 30, daysWorked: 15, daysOff: 8, vacationDays: 7, sickDays: 0, absentDays: 0, holidaysWorked: 0, offDaysWorked: 0, extraMinutes: 0 };
    const r = calculatePay(law, m, "NIGHT");
    expect(r.earnings.find((l) => l.key === "base")!.cents).toBe(156867);
    expect(r.earnings.find((l) => l.key === "night")!.cents).toBe(Math.round(29140 * 23 / 30));
  });

  it("fiestas trabajadas desde el cuadrante: semanas con más de 5 noches, en el mes de su domingo", () => {
    // Octubre 2026 sin fiestas fijas → cada semana con domingo en octubre tiene 7 noches = 2 fiestas trabajadas
    const noFixed = { ...me, fixedDaysOff: [] };
    const all = monthStatsFromSchedule("2026-10", noFixed, [], statusTypes, 2);
    expect(all.offDaysWorked).toBe(4 * 2); // domingos 4, 11, 18, 25
    // con fiestas fijas sábado y domingo (2 por semana) no hay ninguna
    expect(monthStatsFromSchedule("2026-10", me, [], statusTypes, 2).offDaysWorked).toBe(0);
    // trabajando un sábado → 1
    const one = monthStatsFromSchedule("2026-10", me, [entry("2026-10-10", "WORK")], statusTypes, 2);
    expect(one.offDaysWorked).toBe(1);
    // semanas aún no cerradas no cuentan
    expect(monthStatsFromSchedule("2026-10", noFixed, [], statusTypes, 2, "2026-10-12").offDaysWorked).toBe(4); // domingos 4 y 11
  });

  it("primera nómina parcial: prorrata /30 + fiestas trabajadas", () => {
    const stats: MonthStats = {
      daysInMonth: 30, contractDays: 10, daysWorked: 9, daysOff: 1, vacationDays: 0, sickDays: 0, absentDays: 0,
      holidaysWorked: 0, offDaysWorked: 1, extraMinutes: 0,
    };
    const r = calculatePay(law, stats, "NIGHT");
    const line = (k: string) => r.earnings.find((l) => l.key === k)!.cents;
    expect(line("base")).toBe(52289);
    expect(line("night")).toBe(9713);
    expect(line("over40")).toBe(Math.round(8 * overtimeRateCents(law, "NIGHT")));
  });

  it("IRPF anual (Llei 5/2014)", () => {
    expect(andorraIrpfAnnualCents(2200000, 6.5)).toBe(0);
    expect(andorraIrpfAnnualCents(3000000, 6.5)).toBe(15750);
  });
});

describe("mes en curso en tiempo real", () => {
  // Octubre 2026 (1 = jueves), fiestas fijas sábado y domingo; hoy = jueves 15.
  const entries = [entry("2026-10-10", "WORK", { extraMinutes: 120 }), entry("2026-10-20", "VACATION")];
  const p = monthProgress("2026-10", me, entries, statusTypes, 2, "2026-10-15");

  it("separa lo que ya ha pasado del planning del resto", () => {
    expect(p.daysLeft).toBe(16);
    expect(p.soFar).toMatchObject({ daysWorked: 12, daysOff: 3, vacationDays: 0, extraMinutes: 120, offDaysWorked: 1 });
    expect(p.plannedOffLeft).toBe(5); // 17, 18, 24, 25, 31
    expect(p.awayLeft).toBe(1);
    expect(p.planned).toMatchObject({ daysWorked: 22, daysOff: 8, vacationDays: 1, offDaysWorked: 1 });
  });

  it("como el planning: no cambia nada", () => {
    expect(projectMonth(p, 5)).toEqual(p.planned);
  });

  it("menos fiestas que el planning = noches de más y 8 h extra cada una", () => {
    const r = projectMonth(p, 3, 180);
    expect(r).toMatchObject({ daysWorked: 24, daysOff: 6, offDaysWorked: 3, extraMinutes: 300 });
    expect(offDayOvertimeMinutes(r)).toBe(3 * 8 * 60);
  });

  it("más fiestas: no baja de las fiestas trabajadas ya cerradas ni pasa de los días libres que quedan", () => {
    expect(projectMonth(p, 9).offDaysWorked).toBe(1);
    expect(projectMonth(p, 99).daysOff).toBe(3 + 15);
    expect(projectMonth(p, -3).daysOff).toBe(3);
  });
});

describe("cierre de nómina el 27", () => {
  it("periodo del 28 del mes anterior al 27", () => {
    const oct = payPeriodDays("2026-10", 27);
    expect([oct[0], oct.at(-1), oct.length]).toEqual(["2026-09-28", "2026-10-27", 30]);
    const mar = payPeriodDays("2026-03", 27);
    expect([mar[0], mar.at(-1)]).toEqual(["2026-02-28", "2026-03-27"]);
    // sin cierre (o cierre que no cabe) = mes natural
    expect(payPeriodDays("2026-10", null)).toEqual(monthDays("2026-10"));
    expect(payPeriodDays("2026-02", 30)[0]).toBe("2026-01-31"); // cierre que no cabe en febrero: hasta fin de mes
    expect(payPeriodDays("2026-02", 30).at(-1)).toBe("2026-02-28");
    expect(payPeriodDays("2026-03", 30)[0]).toBe("2026-03-01");
  });

  it("después del cierre ya es la nómina del mes siguiente", () => {
    expect(payMonthOf("2026-10-27", 27)).toBe("2026-10");
    expect(payMonthOf("2026-10-28", 27)).toBe("2026-11");
    expect(payMonthOf("2026-12-30", 27)).toBe("2027-01");
    expect(payMonthOf("2026-10-31", null)).toBe("2026-10");
  });

  it("las horas extra del 28 en adelante pasan a la nómina siguiente", () => {
    const extra = [entry("2026-10-27", "WORK", { extraMinutes: 60 }), entry("2026-10-29", "WORK", { extraMinutes: 120 })];
    expect(monthStatsFromSchedule("2026-10", me, extra, statusTypes, 2, undefined, 27).extraMinutes).toBe(60);
    expect(monthStatsFromSchedule("2026-11", me, extra, statusTypes, 2, undefined, 27).extraMinutes).toBe(120);
    // sin cierre: todo en octubre
    expect(monthStatsFromSchedule("2026-10", me, extra, statusTypes, 2).extraMinutes).toBe(180);
  });

  it("una fiesta trabajada cuenta en la nómina del periodo de su domingo", () => {
    // sábado 31 oct trabajado → semana del domingo 1 nov → nómina de noviembre
    const sat = [entry("2026-10-31", "WORK")];
    expect(monthStatsFromSchedule("2026-10", me, sat, statusTypes, 2, undefined, 27).offDaysWorked).toBe(0);
    expect(monthStatsFromSchedule("2026-11", me, sat, statusTypes, 2, undefined, 27).offDaysWorked).toBe(1);
  });
});

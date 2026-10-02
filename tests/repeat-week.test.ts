import { describe, expect, it } from "vitest";
import type { DayEntryLite, EmployeeLite, StatusTypeLite } from "@/lib/schedule";
import { planRepeatWeek, remainingMonthWeeks } from "@/lib/week";

const st = (code: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder,
});
const statusTypes = [st("WORK", true, 0), st("OFF", false, 1), st("VACATION", false, 2), st("SICK", false, 3)];
const emp = (id: string, fixedDaysOff: number[] = []): EmployeeLite => ({
  id, name: id, defaultDepartmentId: "d1", sortOrder: 0, fixedDaysOff, active: true,
});
const entry = (employeeId: string, date: string, code: string, departmentId: string | null = null): DayEntryLite => ({
  employeeId, date, statusTypeId: `st-${code}`, departmentId, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [],
});

describe("semanas que quedan del mes", () => {
  it("semana 28 sep – 4 oct es de octubre: quedan 5, 12, 19 y 26 oct", () => {
    expect(remainingMonthWeeks("2026-09-28")).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });
  it("la última semana del mes no tiene semanas por delante", () => {
    expect(remainingMonthWeeks("2026-10-26")).toEqual([]);
  });
});

describe("repetir semana hasta fin de mes", () => {
  const employees = [emp("ana"), emp("luis", [6])]; // luis libra los domingos por patrón
  const base = { sourceStart: "2026-09-28", employees, statusTypes };

  it("copia fiestas y departamento en cada semana destino", () => {
    const ops = planRepeatWeek({
      ...base,
      targets: ["2026-10-05", "2026-10-12"],
      sourceEntries: [entry("ana", "2026-09-30", "OFF"), entry("ana", "2026-10-01", "WORK", "d2")],
      targetEntries: [],
    });
    const ana = ops.filter((o) => o.employeeId === "ana" && o.kind === "upsert");
    expect(ana.map((o) => o.date).sort()).toEqual(["2026-10-07", "2026-10-08", "2026-10-14", "2026-10-15"]);
    expect(ana.find((o) => o.date === "2026-10-08")).toMatchObject({ statusTypeId: "st-WORK", departmentId: "d2" });
  });

  it("no repite vacaciones ni bajas del origen (vuelve al patrón)", () => {
    const ops = planRepeatWeek({
      ...base,
      targets: ["2026-10-05"],
      sourceEntries: [entry("ana", "2026-10-02", "VACATION"), entry("luis", "2026-10-04", "SICK")],
      targetEntries: [],
    });
    expect(ops).toEqual([]); // ana trabaja y luis libra el domingo: es su patrón, nada que escribir
  });

  it("respeta vacaciones ya puestas en las semanas destino", () => {
    const ops = planRepeatWeek({
      ...base,
      targets: ["2026-10-05"],
      sourceEntries: [entry("ana", "2026-09-28", "OFF")],
      targetEntries: [entry("ana", "2026-10-05", "VACATION")],
    });
    expect(ops.find((o) => o.employeeId === "ana" && o.date === "2026-10-05")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import type { DayEntryLite, EmployeeLite, StatusTypeLite } from "@/lib/schedule";
import {
  nextCycleCode, planCopyWeek, planSetCell, shortNames, statusAbbr, weekHref,
} from "@/lib/week";

const st = (code: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder,
});
const WORK = st("WORK", true, 0);
const OFF = st("OFF", false, 1);
const PAID = st("PAID_OFF", false, 2);
const SICK = st("SICK", false, 3);
const statusTypes = [WORK, OFF, PAID, SICK];

const emp = (id: string, o: Partial<EmployeeLite> = {}): EmployeeLite => ({
  id, name: id, defaultDepartmentId: "d1", sortOrder: 0, fixedDaysOff: [5, 6], active: true, ...o,
});
const entry = (employeeId: string, date: string, s: StatusTypeLite, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId, date, statusTypeId: s.id, departmentId: null, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});

describe("ciclo de estado", () => {
  it("Trabaja -> Fiesta -> Fiesta retribuida -> Trabaja", () => {
    expect(nextCycleCode("WORK")).toBe("OFF");
    expect(nextCycleCode("OFF")).toBe("PAID_OFF");
    expect(nextCycleCode("PAID_OFF")).toBe("WORK");
  });
  it("otros estados no ciclan (abren la hoja)", () => {
    expect(nextCycleCode("SICK")).toBeNull();
    expect(nextCycleCode("VACATION")).toBeNull();
  });
});

describe("statusAbbr / shortNames / weekHref", () => {
  it("abrevia por código y por etiqueta", () => {
    expect(statusAbbr({ code: "OFF", label: "Fiesta" })).toBe("F");
    expect(statusAbbr({ code: "X", label: "curso" })).toBe("C");
  });
  it("desambigua nombres repetidos", () => {
    expect(shortNames(["Alejandro Erwin", "Alejandro Gomez", "Gerard Deu"])).toEqual([
      "Alejandro E.", "Alejandro G.", "Gerard",
    ]);
  });
  it("conserva la vista en el enlace", () => {
    expect(weekHref("2026-09-29", "personas")).toBe("/semana/2026-09-29?v=personas");
    expect(weekHref(null, "dias")).toBe("/semana");
  });
});

describe("planSetCell", () => {
  const e = emp("a"); // fiesta fija sáb (5) y dom (6)
  const base = { employee: e, statusTypes, reason: null, existing: null };
  it("borra si el estado es el del patrón y no hay más datos", () => {
    expect(planSetCell({ ...base, date: "2026-09-29", statusTypeId: WORK.id })).toEqual({ kind: "delete" });
    expect(planSetCell({ ...base, date: "2026-10-03", statusTypeId: OFF.id })).toEqual({ kind: "delete" });
  });
  it("guarda si difiere del patrón", () => {
    expect(planSetCell({ ...base, date: "2026-09-29", statusTypeId: OFF.id })).toEqual({
      kind: "upsert", statusTypeId: OFF.id, reason: null,
    });
    expect(planSetCell({ ...base, date: "2026-10-03", statusTypeId: WORK.id }).kind).toBe("upsert");
  });
  it("guarda si hay motivo o datos extra aunque coincida con el patrón", () => {
    expect(planSetCell({ ...base, date: "2026-09-29", statusTypeId: WORK.id, reason: " tarde " })).toEqual({
      kind: "upsert", statusTypeId: WORK.id, reason: "tarde",
    });
    const existing = entry("a", "2026-09-29", OFF, { note: "hola" });
    expect(planSetCell({ ...base, date: "2026-09-29", statusTypeId: WORK.id, existing }).kind).toBe("upsert");
  });
});

describe("planCopyWeek", () => {
  const employees = [emp("a"), emp("b")];
  const weekStart = "2026-10-05";
  const run = (prevEntries: DayEntryLite[], curEntries: DayEntryLite[] = []) =>
    planCopyWeek({ weekStart, employees, statusTypes, prevEntries, curEntries });

  it("copia entradas de la semana previa desplazadas 7 días", () => {
    expect(run([entry("a", "2026-09-29", SICK, { reason: "gripe" })])).toEqual([
      { kind: "upsert", employeeId: "a", date: "2026-10-06", statusTypeId: SICK.id, departmentId: null, reason: "gripe" },
    ]);
  });
  it("vuelve al patrón donde la previa no tenía entrada (borra entradas vacías)", () => {
    expect(run([], [entry("b", "2026-10-07", OFF)])).toEqual([
      { kind: "delete", employeeId: "b", date: "2026-10-07" },
    ]);
  });
  it("conserva entradas con nota, restaurando el estado del patrón", () => {
    expect(run([], [entry("b", "2026-10-07", OFF, { note: "x" })])).toEqual([
      { kind: "upsert", employeeId: "b", date: "2026-10-07", statusTypeId: WORK.id, departmentId: null, reason: null },
    ]);
  });
  it("no hace nada si ya coincide y borra copias redundantes", () => {
    const p = entry("a", "2026-09-29", SICK);
    expect(run([p], [entry("a", "2026-10-06", SICK)])).toEqual([]);
    expect(run([entry("a", "2026-09-29", WORK)], [entry("a", "2026-10-06", OFF)])).toEqual([
      { kind: "delete", employeeId: "a", date: "2026-10-06" },
    ]);
  });
  it("ignora empleados inactivos", () => {
    const r = planCopyWeek({
      weekStart, employees: [emp("z", { active: false })], statusTypes,
      prevEntries: [entry("z", "2026-09-29", SICK)], curEntries: [],
    });
    expect(r).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { DayEntryLite, EmployeeLite, StatusTypeLite } from "@/lib/schedule";
import {
  compactNames, formatHoursShort, planCopyWeek, planSetCell, shortNames, statusAbbr, weekHref, weekSummary,
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

describe("resumen semanal", () => {
  const VAC = st("VACATION", false, 4);
  const all = [...statusTypes, VAC];
  const cell = (status: StatusTypeLite, extraMinutes: number | null = null) => ({ status, extraMinutes });
  const texts = (cells: ReturnType<typeof cell>[]) => weekSummary(cells, all).map((t) => t.text);

  it("solo muestra lo que hay: 6 trabaja y 1 fiesta", () => {
    expect(texts([...Array(6)].map(() => cell(WORK)).concat(cell(OFF)))).toEqual(["6T", "1F"]);
  });
  it("suma las horas extra al final", () => {
    const cells = [cell(WORK, 60), cell(WORK, 60), cell(WORK), cell(WORK), cell(WORK), cell(OFF), cell(OFF)];
    expect(texts(cells)).toEqual(["5T", "2F", "2X"]);
  });
  it("vacaciones, baja y fiesta retribuida en el orden de los estados", () => {
    const cells = [cell(VAC), cell(VAC), cell(SICK), cell(PAID), cell(WORK, 90), cell(WORK), cell(OFF)];
    expect(texts(cells)).toEqual(["2T", "1F", "1R", "1B", "2V", "1,5X"]);
  });
  it("marca los tokens de días libres", () => {
    const t = weekSummary([cell(WORK), cell(OFF), cell(PAID), cell(SICK)], all);
    expect(t.filter((x) => x.dayOff).map((x) => x.text)).toEqual(["1F", "1R"]);
  });
  it("formatea horas cortas", () => {
    expect(formatHoursShort(120)).toBe("2");
    expect(formatHoursShort(45)).toBe("0,75");
    expect(formatHoursShort(15)).toBe("0,25");
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
  it("no copia horas extra y conserva las de la semana destino", () => {
    const prev = entry("a", "2026-09-29", SICK, { extraMinutes: 60 });
    expect(run([prev])).toEqual([
      { kind: "upsert", employeeId: "a", date: "2026-10-06", statusTypeId: SICK.id, departmentId: null, reason: null },
    ]);
    // destino con horas extra: no se borra aunque la previa siga el patrón
    expect(run([], [entry("b", "2026-10-07", OFF, { extraMinutes: 30 })])).toEqual([
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

describe("compactNames", () => {
  it("usa el alias si existe y el nombre corto si no", () => {
    expect(
      compactNames([
        { name: "Jose Alexander Roman", alias: "Jose A." },
        { name: "Alejandro Erwin", alias: "  " },
        { name: "Alejandro Gomez", alias: null },
        { name: "Fabian" },
      ]),
    ).toEqual(["Jose A.", "Alejandro E.", "Alejandro G.", "Fabian"]);
  });
});

describe("vacaciones / baja de varios días", () => {
  it("solo vacaciones y baja piden días", async () => {
    const { isMultiDayStatus } = await import("@/lib/week");
    expect(isMultiDayStatus("VACATION")).toBe(true);
    expect(isMultiDayStatus("SICK")).toBe(true);
    expect(isMultiDayStatus("OFF")).toBe(false);
  });
  it("días seguidos, también pasando a la semana y al mes siguiente", async () => {
    const { rangeDates } = await import("@/lib/week");
    expect(rangeDates("2026-10-29", 5)).toEqual(["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(rangeDates("2026-10-05", 0)).toEqual(["2026-10-05"]);
    expect(rangeDates("2026-10-05", 500)).toHaveLength(60);
  });
});

describe("resolver falta", () => {
  it("falta en el planning o validada en Hoy", async () => {
    const { isAbsence } = await import("@/lib/week");
    expect(isAbsence("ABSENT", null)).toBe(true);
    expect(isAbsence("WORK", "ABSENT")).toBe(true);
    expect(isAbsence("WORK", "SICK")).toBe(false);
    expect(isAbsence("OFF", null)).toBe(false);
  });
});

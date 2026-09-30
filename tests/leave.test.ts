import { describe, expect, it } from "vitest";
import {
  formatRange, parseAppliedChanges, planLeaveApproval, planLeaveImpact, planLeaveRevert,
  requestDates, summarizeRequest, validateLeaveDates,
} from "@/lib/leave";
import type { DayEntryLite, DepartmentLite, EmployeeLite, StatusTypeLite } from "@/lib/schedule";

const st = (code: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder,
});
const statusTypes = [st("WORK", true, 0), st("OFF", false, 1), st("PAID_OFF", false, 2), st("SICK", false, 3), st("VACATION", false, 4)];
const id = (code: string) => `st-${code}`;

// 2026-10-12 es lunes.
const emp = (i: string, o: Partial<EmployeeLite> = {}): EmployeeLite => ({
  id: i, name: i, defaultDepartmentId: "d1", sortOrder: 0, fixedDaysOff: [5, 6], active: true, ...o,
});
const entry = (employeeId: string, date: string, code: string, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId, date, statusTypeId: id(code), departmentId: null, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});

describe("validateLeaveDates / requestDates", () => {
  it("rango máximo de 60 días", () => {
    expect(validateLeaveDates("VACATION", "2026-10-01", "2026-11-29")).toBeNull(); // 60 días
    expect(validateLeaveDates("VACATION", "2026-10-01", "2026-11-30")).toMatch(/60/);
  });
  it("fin anterior al inicio", () => {
    expect(validateLeaveDates("PAID_OFF", "2026-10-05", "2026-10-04")).not.toBeNull();
  });
  it("cambio de fiesta necesita dos días distintos, sin límite de rango", () => {
    expect(validateLeaveDates("SWAP_OFF", "2026-10-05", "2026-10-05")).not.toBeNull();
    expect(validateLeaveDates("SWAP_OFF", "2026-10-05", "2026-12-25")).toBeNull();
  });
  it("fechas afectadas", () => {
    expect(requestDates({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-14" })).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14",
    ]);
    expect(requestDates({ type: "SWAP_OFF", dateFrom: "2026-10-12", dateTo: "2026-10-20" })).toEqual([
      "2026-10-12", "2026-10-20",
    ]);
  });
});

describe("resumen legible", () => {
  it("rangos", () => {
    expect(formatRange("2026-10-12", "2026-10-18")).toBe("12–18 oct");
    expect(formatRange("2026-09-28", "2026-10-03")).toBe("28 sep – 3 oct");
    expect(formatRange("2026-10-12", "2026-10-12")).toBe("12 oct");
  });
  it("por tipo", () => {
    expect(summarizeRequest({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-18" })).toBe("Vacaciones 12–18 oct · 7 días");
    expect(summarizeRequest({ type: "PAID_OFF", dateFrom: "2026-10-12", dateTo: "2026-10-12" })).toBe("Permiso 12 oct");
    expect(summarizeRequest({ type: "SWAP_OFF", dateFrom: "2026-10-12", dateTo: "2026-10-16" })).toBe(
      "Cambio de fiesta: libra Vie 16 oct en vez de Lun 12 oct",
    );
  });
});

describe("planLeaveApproval", () => {
  const e = emp("e1");

  it("vacaciones: un cambio por día que no era ya vacaciones, con snapshot", () => {
    const entries = [entry("e1", "2026-10-13", "SICK", { reason: "gripe" }), entry("e1", "2026-10-14", "VACATION")];
    const plan = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-14" }, e, entries, statusTypes);
    expect(plan.error).toBeNull();
    expect(plan.changes.map((c) => c.date)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(plan.changes.every((c) => c.toStatusId === id("VACATION"))).toBe(true);
    expect(plan.changes[0]).toMatchObject({ fromStatusId: id("WORK"), prevEntry: null });
    expect(plan.changes[1]).toMatchObject({
      fromStatusId: id("SICK"),
      prevEntry: { statusTypeId: id("SICK"), departmentId: null, reason: "gripe" },
    });
    expect(plan.conflicts).toEqual([{ date: "2026-10-13", statusId: id("SICK") }]);
  });

  it("un día fijo de fiesta cambia a vacaciones sin conflicto", () => {
    const plan = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-17", dateTo: "2026-10-17" }, e, [], statusTypes);
    expect(plan.changes).toEqual([{ date: "2026-10-17", fromStatusId: id("OFF"), toStatusId: id("VACATION"), prevEntry: null }]);
    expect(plan.conflicts).toEqual([]);
  });

  it("una entrada que ya coincide con el patrón no es conflicto", () => {
    const entries = [entry("e1", "2026-10-12", "WORK", { note: "hola" })];
    const plan = planLeaveApproval({ type: "PAID_OFF", dateFrom: "2026-10-12", dateTo: "2026-10-12" }, e, entries, statusTypes);
    expect(plan.conflicts).toEqual([]);
    expect(plan.changes[0]!.toStatusId).toBe(id("PAID_OFF"));
  });

  it("ignora entradas de otros empleados", () => {
    const entries = [entry("e2", "2026-10-12", "SICK")];
    const plan = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-12" }, e, entries, statusTypes);
    expect(plan.conflicts).toEqual([]);
    expect(plan.changes[0]!.fromStatusId).toBe(id("WORK"));
  });

  it("cambio de fiesta: A trabaja, B libra", () => {
    // A = sábado 17 (fijo de fiesta), B = lunes 19
    const plan = planLeaveApproval({ type: "SWAP_OFF", dateFrom: "2026-10-17", dateTo: "2026-10-19" }, e, [], statusTypes);
    expect(plan.changes).toEqual([
      { date: "2026-10-17", fromStatusId: id("OFF"), toStatusId: id("WORK"), prevEntry: null },
      { date: "2026-10-19", fromStatusId: id("WORK"), toStatusId: id("OFF"), prevEntry: null },
    ]);
  });

  it("cambio de fiesta con B ya libre no repite el cambio", () => {
    const plan = planLeaveApproval({ type: "SWAP_OFF", dateFrom: "2026-10-17", dateTo: "2026-10-18" }, e, [], statusTypes);
    expect(plan.changes.map((c) => c.date)).toEqual(["2026-10-17"]);
  });

  it("OTHER no cambia el calendario", () => {
    const plan = planLeaveApproval({ type: "OTHER", dateFrom: "2026-10-12", dateTo: "2026-10-12" }, e, [], statusTypes);
    expect(plan).toEqual({ changes: [], conflicts: [], error: null });
  });

  it("rango mayor de 60 días o falta de estado -> error", () => {
    expect(planLeaveApproval({ type: "VACATION", dateFrom: "2026-01-01", dateTo: "2026-06-01" }, e, [], statusTypes).error).toMatch(/60/);
    const sin = statusTypes.filter((s) => s.code !== "VACATION");
    expect(planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-12" }, e, [], sin).error).toMatch(/VACATION/);
  });
});

describe("planLeaveRevert", () => {
  const e = emp("e1");
  it("restaura estado y motivo previos", () => {
    const entries = [entry("e1", "2026-10-13", "SICK", { reason: "gripe" })];
    const { changes } = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-13" }, e, entries, statusTypes);
    expect(planLeaveRevert(changes)).toEqual([
      { date: "2026-10-12", statusTypeId: id("WORK"), reason: null },
      { date: "2026-10-13", statusTypeId: id("SICK"), reason: "gripe" },
    ]);
  });
  it("respeta días cambiados a mano después de aprobar", () => {
    const { changes } = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-13" }, e, [], statusTypes);
    const cur = new Map([["2026-10-12", id("VACATION")], ["2026-10-13", id("SICK")]]);
    expect(planLeaveRevert(changes, cur).map((w) => w.date)).toEqual(["2026-10-12"]);
  });
  it("appliedChanges sobrevive a JSON y se valida", () => {
    const { changes } = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-13" }, e, [], statusTypes);
    expect(parseAppliedChanges(JSON.parse(JSON.stringify(changes)))).toEqual(changes);
    expect(parseAppliedChanges({ raro: 1 })).toEqual([]);
    expect(parseAppliedChanges(null)).toEqual([]);
  });
});

describe("planLeaveImpact", () => {
  const dept: DepartmentLite = { id: "d1", name: "Droguería", color: "#000", sortOrder: 0, targetStaff: 2 };
  const e1 = emp("e1");
  const e2 = emp("e2");
  const base = { employee: e1, employees: [e1, e2], departments: [dept], statusTypes };

  it("avisa si el departamento queda vacío", () => {
    const entries = [entry("e2", "2026-10-12", "SICK")];
    const { changes } = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-12" }, e1, entries, statusTypes);
    const issues = planLeaveImpact({ ...base, changes, entries });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ date: "2026-10-12", kind: "empty", departmentName: "Droguería", before: 1, after: 0 });
  });

  it("avisa si queda bajo plazas", () => {
    const { changes } = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-12" }, e1, [], statusTypes);
    const issues = planLeaveImpact({ ...base, changes, entries: [] });
    expect(issues[0]).toMatchObject({ kind: "under", before: 2, after: 1, target: 2 });
  });

  it("sin aviso si ya estaba vacío/bajo y no empeora, o si el día era libre", () => {
    const { changes } = planLeaveApproval({ type: "VACATION", dateFrom: "2026-10-17", dateTo: "2026-10-17" }, e1, [], statusTypes);
    expect(planLeaveImpact({ ...base, changes, entries: [] })).toEqual([]);
  });
});

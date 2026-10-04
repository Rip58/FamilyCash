import { describe, expect, it } from "vitest";
import { type DayEntryLite, type DepartmentLite, type EmployeeLite, type StatusTypeLite, getDayRoster } from "@/lib/schedule";
import { applyEntryPatch, isEntryRedundant, toggleDepartment } from "@/lib/segments";

const st = (code: string, isWorking: boolean): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder: 0,
});
const WORK = st("WORK", true);
const SICK = st("SICK", false);
const statusTypes = [WORK, st("OFF", false), SICK];
const dep = (id: string, targetStaff: number): DepartmentLite => ({ id, name: id, color: "#123", sortOrder: 0, targetStaff });
const departments = [dep("drog", 2), dep("bot", 1), dep("perf", 1)];
const emp = (id: string, dept: string | null): EmployeeLite => ({
  id, name: id, defaultDepartmentId: dept, sortOrder: 0, fixedDaysOff: [], active: true,
});
const MON = "2026-09-28";
const entry = (employeeId: string, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId, date: MON, statusTypeId: WORK.id, departmentId: null, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});

describe("varios departamentos en una noche", () => {
  it("elegir/quitar: el primero es el principal; sin ninguno vuelve al habitual", () => {
    expect(toggleDepartment("drog", [], "bot")).toEqual({ main: "drog", extras: ["bot"] });
    expect(toggleDepartment("drog", ["bot"], "perf")).toEqual({ main: "drog", extras: ["bot", "perf"] });
    expect(toggleDepartment("drog", ["bot"], "drog")).toEqual({ main: "bot", extras: [] });
    expect(toggleDepartment("drog", ["bot"], "bot")).toEqual({ main: "drog", extras: [] });
    expect(toggleDepartment("drog", [], "drog")).toEqual({ main: null, extras: [] });
  });

  it("cubre los departamentos extra: cuenta en sus plazas y ya no salen vacíos", () => {
    const employees = [emp("Ana", "drog"), emp("Luis", "drog")];
    const before = getDayRoster({ date: MON, employees, entries: [], departments, statusTypes });
    expect(before.departments.find((d) => d.department.id === "bot")!.isEmpty).toBe(true);
    const r = getDayRoster({
      date: MON, employees, departments, statusTypes,
      entries: [entry("Ana", { extraDepartmentIds: ["bot", "perf", "drog"] })],
    });
    const bot = r.departments.find((d) => d.department.id === "bot")!;
    expect(bot.covering.map((m) => m.employee.id)).toEqual(["Ana"]);
    expect([bot.staffed, bot.isEmpty, bot.present.length]).toEqual([1, false, 0]);
    const drog = r.departments.find((d) => d.department.id === "drog")!;
    // sigue en su principal sin repetirse, y el principal no cuenta como extra
    expect(drog.present.map((m) => m.employee.id)).toEqual(["Ana", "Luis"]);
    expect(drog.covering).toEqual([]);
    expect(r.departments.find((d) => d.department.id === "drog")!.present[0]!.day.extraDepartmentIds).toEqual(["bot", "perf"]);
  });

  it("si no viene, no cubre nada", () => {
    const r = getDayRoster({
      date: MON, employees: [emp("Ana", "drog")], departments, statusTypes,
      entries: [entry("Ana", { actualStatusTypeId: SICK.id, extraDepartmentIds: ["bot"] })],
    });
    expect(r.departments.find((d) => d.department.id === "bot")!.isEmpty).toBe(true);
  });

  it("guardar: el principal habitual queda null, los extras sin repetir; sin extras el registro sobra", () => {
    const ana = emp("Ana", "drog");
    const e = applyEntryPatch(undefined, ana, MON, statusTypes, { kind: "department", departmentId: null, extraDepartmentIds: ["bot", "drog", "bot"] }, "21:30");
    expect([e.departmentId, e.extraDepartmentIds]).toEqual([null, ["bot"]]);
    expect(isEntryRedundant(e, ana, MON, statusTypes)).toBe(false);
    const back = applyEntryPatch(e, ana, MON, statusTypes, { kind: "department", departmentId: null, extraDepartmentIds: [] }, "21:30");
    expect(isEntryRedundant(back, ana, MON, statusTypes)).toBe(true);
    // cambiar solo el principal mantiene los extras (menos el nuevo principal)
    const moved = applyEntryPatch(e, ana, MON, statusTypes, { kind: "department", departmentId: "bot" }, "21:30");
    expect([moved.departmentId, moved.extraDepartmentIds]).toEqual(["bot", []]);
  });
});

describe("departamentos secundarios (comodín, palets…)", () => {
  it("vacío no cuenta como sin personal ni falta gente", () => {
    const deps = [dep("drog", 2), { ...dep("comodin", 1), secondary: true }];
    const r = getDayRoster({ date: MON, employees: [emp("Ana", "drog")], entries: [], departments: deps, statusTypes });
    const c = r.departments.find((d) => d.department.id === "comodin")!;
    expect([c.isEmpty, c.isUnderStaffed, c.staffed]).toEqual([false, false, 0]);
    // el normal sí avisa
    expect(r.departments.find((d) => d.department.id === "drog")!.isUnderStaffed).toBe(true);
  });
});

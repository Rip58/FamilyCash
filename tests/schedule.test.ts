import { describe, expect, it } from "vitest";
import {
  type DayEntryLite, type DepartmentLite, type EmployeeLite, type StatusTypeLite,
  getDayRoster, getEffectiveDay, getWeekGrid,
} from "@/lib/schedule";

const st = (code: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder,
});
const WORK = st("WORK", true, 0);
const OFF = st("OFF", false, 1);
const PAID = st("PAID_OFF", false, 2);
const SICK = st("SICK", false, 3);
const VAC = st("VACATION", false, 4);
const statusTypes = [VAC, SICK, PAID, OFF, WORK]; // desordenados a propósito

const dep = (id: string, sortOrder: number, targetStaff: number): DepartmentLite => ({
  id, name: id, color: "#111", sortOrder, targetStaff,
});
const DROG = dep("drog", 0, 2);
const BOT = dep("bot", 1, 1);
const departments = [BOT, DROG];

const emp = (id: string, o: Partial<EmployeeLite> = {}): EmployeeLite => ({
  id, name: id, defaultDepartmentId: "drog", sortOrder: 0, fixedDaysOff: [], active: true, ...o,
});
const entry = (employeeId: string, date: string, st: StatusTypeLite, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId, date, statusTypeId: st.id, departmentId: null, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});

// 2026-09-28 lunes … 2026-10-04 domingo
const MON = "2026-09-28";
const TUE = "2026-09-29";

describe("getEffectiveDay", () => {
  it("por defecto trabaja en su departamento habitual", () => {
    const d = getEffectiveDay(emp("a"), MON, undefined, statusTypes);
    expect(d.status.code).toBe("WORK");
    expect(d.departmentId).toBe("drog");
    expect(d.source).toBe("default");
    expect(d.isWorking).toBe(true);
  });
  it("día fijo de fiesta -> OFF", () => {
    const e = emp("a", { fixedDaysOff: [0, 6] });
    expect(getEffectiveDay(e, MON, undefined, statusTypes).status.code).toBe("OFF");
    expect(getEffectiveDay(e, MON, undefined, statusTypes).source).toBe("fixed");
    expect(getEffectiveDay(e, TUE, undefined, statusTypes).status.code).toBe("WORK");
    expect(getEffectiveDay(e, "2026-10-04", undefined, statusTypes).status.code).toBe("OFF");
  });
  it("la excepción (DayEntry) gana al día fijo", () => {
    const e = emp("a", { fixedDaysOff: [0] });
    const d = getEffectiveDay(e, MON, entry("a", MON, WORK, { note: "hace extra" }), statusTypes);
    expect(d.status.code).toBe("WORK");
    expect(d.source).toBe("entry");
    expect(d.note).toBe("hace extra");
  });
  it("entry no laborable con motivo", () => {
    const d = getEffectiveDay(emp("a"), MON, entry("a", MON, SICK, { reason: "gripe" }), statusTypes);
    expect(d.isWorking).toBe(false);
    expect(d.isDayOff).toBe(false);
    expect(d.reason).toBe("gripe");
  });
  it("cambio de departamento con entry", () => {
    const d = getEffectiveDay(emp("a"), MON, entry("a", MON, WORK, { departmentId: "bot" }), statusTypes);
    expect(d.departmentId).toBe("bot");
  });
  it("ordena los tramos", () => {
    const seg = (sortOrder: number, start: string) => ({ sectionId: null, label: start, start, end: "x", note: null, sortOrder });
    const d = getEffectiveDay(emp("a"), MON, entry("a", MON, WORK, { segments: [seg(1, "b"), seg(0, "a")] }), statusTypes);
    expect(d.segments.map((s) => s.start)).toEqual(["a", "b"]);
  });
  it("estado desconocido lanza error", () => {
    expect(() => getEffectiveDay(emp("a"), MON, { ...entry("a", MON, WORK), statusTypeId: "nope" }, statusTypes)).toThrow();
  });
});

describe("getDayRoster", () => {
  const base = (employees: EmployeeLite[], entries: DayEntryLite[] = []) =>
    getDayRoster({ date: MON, employees, entries, departments, statusTypes });

  it("agrupa por departamento respetando sortOrder de departamentos y empleados", () => {
    const r = base([
      emp("z", { sortOrder: 0, defaultDepartmentId: "bot" }),
      emp("b", { sortOrder: 2 }),
      emp("a", { sortOrder: 1 }),
    ]);
    expect(r.departments.map((d) => d.department.id)).toEqual(["drog", "bot"]);
    expect(r.departments[0]!.present.map((m) => m.employee.id)).toEqual(["a", "b"]);
    expect(r.presentCount).toBe(3);
  });
  it("excluye empleados inactivos", () => {
    const r = base([emp("a"), emp("x", { active: false })]);
    expect(r.presentCount).toBe(1);
    expect(r.countsByStatus.reduce((n, c) => n + c.count, 0)).toBe(1);
  });
  it("excepción con DayEntry: ausentes agrupados por estado con motivo", () => {
    const r = base(
      [emp("a"), emp("b"), emp("c")],
      [entry("a", MON, SICK, { reason: "gripe" }), entry("b", MON, VAC)],
    );
    expect(r.absentByStatus.map((g) => g.status.code)).toEqual(["SICK", "VACATION"]);
    expect(r.absentByStatus[0]!.members[0]!.day.reason).toBe("gripe");
    expect(r.departments[0]!.present.map((m) => m.employee.id)).toEqual(["c"]);
    expect(r.departments[0]!.absent.map((m) => m.employee.id)).toEqual(["a", "b"]);
  });
  it("cambio de departamento: aparece en el destino, no en el habitual", () => {
    const r = base([emp("a"), emp("b")], [entry("a", MON, WORK, { departmentId: "bot" })]);
    expect(r.departments.find((d) => d.department.id === "bot")!.present.map((m) => m.employee.id)).toEqual(["a"]);
    expect(r.departments.find((d) => d.department.id === "drog")!.present.map((m) => m.employee.id)).toEqual(["b"]);
  });
  it("departamento vacío", () => {
    const r = base([emp("a")], []); // Botellería sin nadie
    expect(r.emptyDepartments.map((d) => d.id)).toEqual(["bot"]);
    expect(r.departments[1]!.isEmpty).toBe(true);
  });
  it("departamento vacío por ausencia, con quién falta", () => {
    const r = base([emp("j", { defaultDepartmentId: "bot" })], [entry("j", MON, VAC, { reason: "viaje" })]);
    const bot = r.departments.find((d) => d.department.id === "bot")!;
    expect(bot.isEmpty).toBe(true);
    expect(bot.absent[0]!.day.reason).toBe("viaje");
  });
  it("bajo plazas (0 < presentes < plazas)", () => {
    const r = base([emp("a"), emp("j", { defaultDepartmentId: "bot" })]);
    expect(r.underStaffedDepartments.map((d) => d.id)).toEqual(["drog"]); // 1 de 2
    expect(r.departments[0]!.isEmpty).toBe(false);
    expect(r.departments[1]!.isUnderStaffed).toBe(false); // 1 de 1
    expect(r.emptyDepartments).toHaveLength(0);
  });
  it("sin departamento -> unassigned", () => {
    const r = base([emp("a", { defaultDepartmentId: null })]);
    expect(r.unassigned.map((m) => m.employee.id)).toEqual(["a"]);
  });
  it("cuenta por estado", () => {
    const r = base([emp("a"), emp("b", { fixedDaysOff: [0] })]);
    expect(r.countsByStatus.map((c) => [c.status.code, c.count])).toEqual([["WORK", 1], ["OFF", 1]]);
  });
});

describe("getWeekGrid", () => {
  const grid = (employees: EmployeeLite[], entries: DayEntryLite[] = [], daysOffPerWeek = 2) =>
    getWeekGrid({ date: "2026-09-30", employees, entries, departments, statusTypes, daysOffPerWeek });

  it("7 celdas por empleado y conteo de días libres", () => {
    const g = grid([emp("a", { fixedDaysOff: [5, 6] })]);
    expect(g.days[0]).toBe(MON);
    expect(g.rows[0]!.cells).toHaveLength(7);
    expect(g.rows[0]!.daysOff).toBe(2);
    expect(g.rows[0]!.offWarning).toBe(false);
  });
  it("aviso si los días libres ≠ daysOffPerWeek", () => {
    expect(grid([emp("a", { fixedDaysOff: [6] })]).rows[0]!.offWarning).toBe(true);
    expect(grid([emp("a", { fixedDaysOff: [4, 5, 6] })]).rows[0]!.daysOff).toBe(3);
    expect(grid([emp("a", { fixedDaysOff: [4, 5, 6] })], [], 3).rows[0]!.offWarning).toBe(false);
  });
  it("PAID_OFF cuenta; SICK y VACATION no", () => {
    const g = grid(
      [emp("a", { fixedDaysOff: [6] })],
      [entry("a", MON, PAID), entry("a", TUE, SICK), entry("a", "2026-09-30", VAC)],
    );
    expect(g.rows[0]!.daysOff).toBe(2); // domingo (OFF) + lunes (PAID_OFF)
  });
  it("una excepción a WORK en día fijo resta un día libre", () => {
    const g = grid([emp("a", { fixedDaysOff: [5, 6] })], [entry("a", "2026-10-03", WORK)]);
    expect(g.rows[0]!.daysOff).toBe(1);
    expect(g.rows[0]!.offWarning).toBe(true);
  });
  it("agrupa por departamento habitual y excluye inactivos", () => {
    const g = grid([
      emp("a"),
      emp("j", { defaultDepartmentId: "bot" }),
      emp("n", { defaultDepartmentId: null }),
      emp("x", { active: false }),
    ]);
    expect(g.groups.map((x) => x.department?.id ?? null)).toEqual(["drog", "bot", null]);
    expect(g.rows).toHaveLength(3);
  });
});

describe("asistencia en el día efectivo", () => {
  it("present solo cuenta si trabaja", async () => {
    const { getEffectiveDay } = await import("@/lib/schedule");
    const sts = [
      { id: "w", code: "WORK", label: "Trabaja", color: "#000", isWorking: true, sortOrder: 0 },
      { id: "o", code: "OFF", label: "Fiesta", color: "#000", isWorking: false, sortOrder: 1 },
    ];
    const employee = { id: "e", name: "E", defaultDepartmentId: null, sortOrder: 0, fixedDaysOff: [], active: true };
    const base = { employeeId: "e", date: "2026-09-28", departmentId: null, reason: null, note: null, arrivedAt: null, leftAt: null, timeReason: null, segments: [] };
    expect(getEffectiveDay(employee, "2026-09-28", { ...base, statusTypeId: "w", present: true }, sts).present).toBe(true);
    expect(getEffectiveDay(employee, "2026-09-28", { ...base, statusTypeId: "o", present: true }, sts).present).toBe(false);
    expect(getEffectiveDay(employee, "2026-09-28", null, sts).present).toBe(false);
  });
});

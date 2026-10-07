import { describe, expect, it } from "vitest";
import { type DayEntryLite, type DepartmentLite, type EmployeeLite, type StatusTypeLite, getDayRoster } from "@/lib/schedule";
import { daySummary } from "@/lib/week";

const st = (code: string, label: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`, code, label, color: "#3b82f6", isWorking, sortOrder,
});
const WORK = st("WORK", "Trabaja", true, 0);
const OFF = st("OFF", "Fiesta", false, 1);
const VAC = st("VACATION", "Vacaciones", false, 2);
const SICK = st("SICK", "Baja laboral", false, 3);
const statusTypes = [WORK, OFF, VAC, SICK];
const dep = (id: string, name: string, sortOrder: number, targetStaff: number): DepartmentLite => ({
  id, name, color: "#123456", sortOrder, targetStaff,
});
const departments = [dep("drog", "Droguería", 0, 2), dep("bot", "Botellería", 1, 1)];
const emp = (id: string, dept: string): EmployeeLite => ({
  id, name: id, defaultDepartmentId: dept, sortOrder: 0, fixedDaysOff: [], active: true,
});
const entry = (employeeId: string, s: StatusTypeLite): DayEntryLite => ({
  employeeId, date: MON, statusTypeId: s.id, departmentId: null, reason: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [],
});
const MON = "2026-09-28";
const employees = [emp("Ana", "drog"), emp("Luis", "drog"), emp("Pepe", "drog"), emp("Rosa", "bot")];
const summary = (entries: DayEntryLite[]) =>
  daySummary(getDayRoster({ date: MON, employees, entries, departments, statusTypes }));

describe("resumen del día (Semana → Días)", () => {
  it("todo cubierto: completo, con quién libra aparte", () => {
    const s = summary([entry("Pepe", OFF)]);
    expect(s).toMatchObject({ level: "ok", present: 3, missing: 0, issues: [], off: ["Pepe"], away: [] });
  });
  it("faltan plazas por vacaciones o baja: aviso y cuántas faltan", () => {
    const s = summary([entry("Ana", VAC), entry("Luis", SICK)]);
    expect(s.level).toBe("warn");
    expect(s.missing).toBe(1);
    expect(s.issues).toEqual([{ name: "Droguería", present: 1, target: 2 }]);
    expect(s.away.map((g) => [g.label, g.names])).toEqual([
      ["Vacaciones", ["Ana"]],
      ["Baja laboral", ["Luis"]],
    ]);
  });
  it("un departamento sin nadie es grave", () => {
    const s = summary([entry("Rosa", SICK)]);
    expect(s.level).toBe("bad");
    expect(s.issues).toEqual([{ name: "Botellería", present: 0, target: 1 }]);
    expect(s.missing).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { buildExportRows } from "@/lib/export";
import { DEFAULT_SHIFT, buildWeekSummary } from "@/lib/report";
import {
  type DayEntryLite,
  type DepartmentLite,
  type EmployeeLite,
  type StatusTypeLite,
  getDayRoster,
  getWeekGrid,
  hasStarted,
} from "@/lib/schedule";
import { planCopyWeek } from "@/lib/week";

const status = (code: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`,
  code,
  label: code,
  color: "#64748b",
  isWorking,
  sortOrder,
});
const WORK = status("WORK", true, 0);
const OFF = status("OFF", false, 1);
const SICK = status("SICK", false, 2);
const statusTypes = [WORK, OFF, SICK];
const departments: DepartmentLite[] = [
  { id: "d1", name: "Droguería", color: "#64748b", sortOrder: 0, targetStaff: 1 },
];
const employee = (startDate: string | null): EmployeeLite => ({
  id: "ana",
  name: "Ana",
  startDate,
  defaultDepartmentId: "d1",
  sortOrder: 0,
  fixedDaysOff: [5, 6],
  active: true,
});
const entry = (date: string, state: StatusTypeLite, extra: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId: "ana",
  date,
  statusTypeId: state.id,
  departmentId: null,
  reason: null,
  arrivedAt: null,
  leftAt: null,
  timeReason: null,
  segments: [],
  ...extra,
});

describe("fecha de inicio", () => {
  it("considera desde siempre el valor nulo y compara el primer día incluido", () => {
    expect(hasStarted(employee(null), "2026-10-01")).toBe(true);
    const ana = employee("2026-10-07");
    expect(hasStarted(ana, "2026-10-06")).toBe(false);
    expect(hasStarted(ana, "2026-10-07")).toBe(true);
    expect(hasStarted(ana, "2026-10-08")).toBe(true);
  });

  it("no incluye al empleado en Hoy antes de empezar y sí el primer día", () => {
    const ana = employee("2026-10-07");
    const roster = (date: string) =>
      getDayRoster({ date, employees: [ana], entries: [], departments, statusTypes });
    expect(roster("2026-10-06").presentCount).toBe(0);
    expect(roster("2026-10-06").departments[0]!.present).toEqual([]);
    expect(roster("2026-10-07").departments[0]!.present.map((m) => m.employee.id)).toEqual(["ana"]);
  });

  it("oculta semanas anteriores y marca como parcial la semana de inicio", () => {
    const ana = employee("2026-10-07");
    const grid = (date: string) =>
      getWeekGrid({ date, employees: [ana], entries: [], departments, statusTypes, daysOffPerWeek: 2 });
    expect(grid("2026-09-28").rows).toEqual([]);
    expect(grid("2026-10-05").rows[0]!.started).toEqual([false, false, true, true, true, true, true]);
    expect(grid("2026-10-05").rows[0]!.offWarning).toBe(false);
    expect(grid("2026-10-12").rows[0]!.started).toEqual([true, true, true, true, true, true, true]);
  });

  it("el informe semanal no cuenta datos anteriores al inicio", () => {
    const ana = employee("2026-10-07");
    const entries = [
      entry("2026-10-05", WORK, { arrivedAt: "23:00", extraMinutes: 60 }),
      entry("2026-10-08", SICK),
    ];
    const grid = getWeekGrid({ date: "2026-10-05", employees: [ana], entries, departments, statusTypes, daysOffPerWeek: 2 });
    const rosters = grid.days.map((date) =>
      getDayRoster({ date, employees: [ana], entries, departments, statusTypes }),
    );
    const summary = buildWeekSummary({
      date: "2026-10-05",
      grid,
      statusTypes,
      rosters,
      shift: DEFAULT_SHIFT,
    });
    expect(summary.byType.map((x) => [x.status.code, x.count])).toEqual([
      ["OFF", 2],
      ["SICK", 1],
    ]);
    expect(summary.totalExtraMinutes).toBe(0);
    expect(summary.totalLate).toBe(0);
  });

  it("copiar una semana no genera operaciones anteriores al inicio", () => {
    const ana = employee("2026-10-07");
    const ops = planCopyWeek({
      weekStart: "2026-10-05",
      employees: [ana],
      statusTypes,
      prevEntries: [entry("2026-09-28", SICK), entry("2026-09-30", SICK)],
      curEntries: [],
    });
    expect(ops).toEqual([
      {
        kind: "upsert",
        employeeId: "ana",
        date: "2026-10-07",
        statusTypeId: SICK.id,
        departmentId: null,
        reason: null,
      },
    ]);
  });

  it("el CSV omite incluso una entrada antigua anterior al inicio", () => {
    const rows = buildExportRows({
      from: "2026-10-06",
      to: "2026-10-07",
      employees: [employee("2026-10-07")],
      departments,
      statusTypes,
      sections: [],
      entries: [entry("2026-10-06", SICK)],
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]![0]).toBe("2026-10-07");
  });
});

import { buildShareModel, colorEmoji, shareModelToText } from "@/lib/report-share";
import { describe, expect, it } from "vitest";
import type { NoteView } from "@/lib/notes";
import {
  type DayEntryLite, type DepartmentLite, type EmployeeLite, type StatusTypeLite,
  getDayRoster, getWeekGrid,
} from "@/lib/schedule";
import {
  DEFAULT_SHIFT, buildDayReport, buildWeekSummary, formatDuration, lateMinutes, leaveDelta,
  minutesFromShiftStart, reportToText,
} from "@/lib/report";

const note = (o: Partial<NoteView>): NoteView => ({
  id: "n", date: "2026-09-28", time: null, type: "NOTE", done: false, text: "", employeeId: null, employeeName: null,
  departmentId: null, departmentName: null, sectionId: null, sectionName: null, photos: [], ...o,
});

const st = (code: string, label: string, isWorking: boolean, sortOrder: number): StatusTypeLite => ({
  id: `st-${code}`, code, label, color: "#000", isWorking, sortOrder,
});
const WORK = st("WORK", "Trabaja", true, 0);
const OFF = st("OFF", "Fiesta", false, 1);
const SICK = st("SICK", "Baja laboral", false, 3);
const ABSENT = st("ABSENT", "Falta", false, 5);
const statusTypes = [WORK, OFF, SICK, ABSENT];

const dep = (id: string, name: string, sortOrder: number, targetStaff: number): DepartmentLite => ({
  id, name, color: "#123456", sortOrder, targetStaff,
});
const departments = [dep("drog", "Droguería", 0, 2), dep("bot", "Botellería", 1, 1)];
const emp = (id: string, o: Partial<EmployeeLite> = {}): EmployeeLite => ({
  id, name: id, defaultDepartmentId: "drog", sortOrder: 0, fixedDaysOff: [], active: true, ...o,
});
const entry = (employeeId: string, date: string, s: StatusTypeLite, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId, date, statusTypeId: s.id, departmentId: null, reason: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});
const seg = (start: string, end: string, label: string, sortOrder = 0) => ({
  sectionId: null, label, start, end, note: null, sortOrder,
});

const MON = "2026-09-28";
const sections = [{ id: "sec1", name: "Cerveza" }];

describe("tiempo desde el inicio del turno", () => {
  it("cruza medianoche", () => {
    expect(minutesFromShiftStart("21:30", "21:30")).toBe(0);
    expect(minutesFromShiftStart("23:00", "21:30")).toBe(90);
    expect(minutesFromShiftStart("00:30", "21:30")).toBe(180);
    expect(minutesFromShiftStart("06:30", "21:30")).toBe(540);
  });
  it("salir antes / después del fin de turno", () => {
    expect(leaveDelta("06:30", DEFAULT_SHIFT)).toBe(0);
    expect(leaveDelta("07:30", DEFAULT_SHIFT)).toBe(60);
    expect(leaveDelta("04:00", DEFAULT_SHIFT)).toBe(-150);
    expect(leaveDelta("23:45", DEFAULT_SHIFT)).toBe(-405);
  });
  it("llegada tarde", () => {
    expect(lateMinutes("22:15", DEFAULT_SHIFT)).toBe(45);
    expect(lateMinutes("00:10", DEFAULT_SHIFT)).toBe(160);
    expect(lateMinutes("21:00", DEFAULT_SHIFT)).toBe(0);
  });
  it("formatea duraciones", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(75)).toBe("1 h 15 min");
  });
});

function report() {
  const employees = [
    emp("Ana", { sortOrder: 0 }),
    emp("Beto", { sortOrder: 1 }),
    emp("Carla", { sortOrder: 2, defaultDepartmentId: "bot" }),
    emp("Dani", { sortOrder: 3 }),
    emp("Eva", { sortOrder: 4, defaultDepartmentId: "bot" }),
  ];
  const entries = [
    entry("Ana", MON, WORK, {
      arrivedAt: "22:15", timeReason: "Tren",
      segments: [seg("21:30", "05:00", "Cerveza", 0), seg("05:00", "06:30", "Chocolate", 1)],
    }),
    entry("Beto", MON, WORK, { leftAt: "04:00", timeReason: "Médico" }),
    entry("Carla", MON, WORK, { departmentId: "drog" }),
    entry("Dani", MON, SICK, { reason: "Gripe" }),
    entry("Eva", MON, WORK, { leftAt: "07:30", timeReason: "Inventario" }),
  ];
  const roster = getDayRoster({ date: MON, employees, entries, departments, statusTypes });
  return buildDayReport({
    roster, shift: DEFAULT_SHIFT, sections, departments,
    notes: [note({ id: "b", employeeId: "beto", employeeName: "Beto", text: "Rápido" }), note({ id: "g", text: "Noche tranquila" })],
  });
}

describe("buildDayReport", () => {
  const r = report();
  it("varias notas de la noche, generales y de empleado", () => {
    const t = reportToText({ ...r, notes: [note({ text: "Han llegado todos a la hora" }), note({ employeeId: "x", employeeName: "Ana", text: "Muy bien con el inventario" })] });
    expect(t).toContain("📝 NOTAS DE LA NOCHE\n• Han llegado todos a la hora\n• Ana: Muy bien con el inventario");
  });
  it("tareas, departamento, tipo y fotos en las notas", () => {
    const t = reportToText({ ...r, notes: [
      note({ id: "t1", employeeId: "x", employeeName: "Ana", type: "TASK", text: "Apuntar horas extra en el Excel" }),
      note({ id: "t2", departmentId: "d", departmentName: "Droguería", type: "TASK", done: true, text: "Pedir cajas" }),
      note({ id: "t3", type: "INCIDENT", text: "Palé roto", sectionName: "Cerveza", photos: [{ id: "p", url: "u", width: 1, height: 1, size: 1 }] }),
    ] });
    expect(t).toContain("• Ana: ☐ Apuntar horas extra en el Excel");
    expect(t).toContain("• Droguería: ✅ Pedir cajas");
    expect(t).toContain("• Incidencia: Palé roto [Cerveza] (📷 1)");
  });
  it("las notas generales van primero", () => {
    expect(r.notes.map((n) => n.text)).toEqual(["Noche tranquila", "Rápido"]);
    expect(reportToText(r)).toContain("📝 NOTAS DE LA NOCHE\n• Noche tranquila\n• Beto: Rápido");
  });
  it("incidencias", () => {
    expect(r.lateArrivals).toEqual([{ name: "Ana", arrivedAt: "22:15", minutes: 45, reason: "Tren" }]);
    expect(r.leaveDeviations.map((d) => [d.name, d.kind, d.minutes])).toEqual([
      ["Beto", "early", 150],
      ["Eva", "stayed", 60],
    ]);
    expect(r.absences[0]).toMatchObject({ label: "Baja laboral", members: [{ name: "Dani", reason: "Gripe" }] });
  });
  it("tramos y departamento movido", () => {
    const ana = r.departments[0]!.members.find((m) => m.name === "Ana")!;
    expect(ana.segments.map((s) => [s.relStart, s.relEnd])).toEqual([[0, 450], [450, 540]]);
    const carla = r.departments[0]!.members.find((m) => m.name === "Carla")!;
    expect(carla.movedFrom).toBe("Botellería");
    expect(r.shift.breakFrom).toBe(270);
    expect(r.shift.breakTo).toBe(330);
  });
  it("texto para compartir", () => {
    const t = reportToText(r);
    expect(t).toContain("🌙 INFORME DE NOCHE\n📅 Lunes 28 sep");
    expect(t).toContain("Beto se va 2 h 30 min antes (sale a las 04:00) — Médico");
    expect(t).toContain("Eva se queda 1 h más");
    expect(t).toContain("🌴 VACACIONES Y BAJAS (1)\nBaja laboral: Dani (Gripe)");
    expect(t).not.toContain("FALTAN");
    expect(t).toContain("Ana llega tarde a las 22:15 (+45 min) — Tren");
    // Orden: trabajan → fiesta → faltan.
    expect(t.indexOf("TRABAJAN")).toBeGreaterThan(0);
    expect(t.indexOf("VACACIONES")).toBeGreaterThan(t.indexOf("TRABAJAN"));
    expect(t).toMatch(/Droguería: Ana \(⏰ 22:15\)/);
    expect(t).not.toContain("*");
    expect(t).toContain("Carla (de Botellería)");
    expect(t).toContain("Noche tranquila");
  });
});

describe("horas extra en informes", () => {
  const employees = [emp("Ana"), emp("Beto", { defaultDepartmentId: "bot" })];
  const entries = [
    entry("Ana", MON, WORK, { extraMinutes: 60, extraNote: "Camión" }),
    entry("Beto", MON, WORK, { extraMinutes: 30 }),
    entry("Ana", "2026-09-29", WORK, { extraMinutes: 45 }),
    entry("Beto", "2026-09-30", SICK, { extraMinutes: 120 }),
  ];
  it("bloque diario con total y texto compartido", () => {
    const roster = getDayRoster({ date: MON, employees, entries, departments, statusTypes });
    const r = buildDayReport({ roster, shift: DEFAULT_SHIFT, sections: [], departments });
    expect(r.overtime.totalMinutes).toBe(90);
    expect(r.overtime.items.map((i) => i.name)).toEqual(["Ana", "Beto"]);
    const t = reportToText(r);
    expect(t).toContain("⏱️ HORAS EXTRA (total 1 h 30 min)");
    expect(t).toContain("• Ana: +1 h — Camión");
    expect(t).toContain("• Beto: +30 min");
  });
  it("sin horas extra no hay bloque", () => {
    const roster = getDayRoster({ date: MON, employees, entries: [], departments, statusTypes });
    const r = buildDayReport({ roster, shift: DEFAULT_SHIFT, sections: [], departments });
    expect(r.overtime.items).toEqual([]);
    expect(reportToText(r)).not.toContain("HORAS EXTRA");
  });
  it("suma semanal por empleado ignora días que no trabaja", () => {
    const grid = getWeekGrid({ date: MON, employees, entries, departments, statusTypes, daysOffPerWeek: 2 });
    const rosters = grid.days.map((date) => getDayRoster({ date, employees, entries, departments, statusTypes }));
    const s = buildWeekSummary({ date: MON, grid, statusTypes, rosters, shift: DEFAULT_SHIFT });
    expect(s.byEmployee.find((e) => e.name === "Ana")!.extraMinutes).toBe(105);
    expect(s.byEmployee.find((e) => e.name === "Beto")!.extraMinutes).toBe(30);
    expect(s.totalExtraMinutes).toBe(135);
  });
});

describe("buildWeekSummary", () => {
  it("cuenta ausencias, tardes y departamentos vacíos", () => {
    const employees = [emp("Ana", { fixedDaysOff: [5, 6] }), emp("Beto", { defaultDepartmentId: "bot" })];
    const entries = [
      entry("Ana", MON, WORK, { arrivedAt: "22:00" }),
      entry("Beto", MON, SICK, { reason: "Gripe" }),
      entry("Beto", "2026-09-29", SICK),
    ];
    const grid = getWeekGrid({ date: MON, employees, entries, departments, statusTypes, daysOffPerWeek: 2 });
    const rosters = grid.days.map((date) =>
      getDayRoster({ date, employees, entries, departments, statusTypes }),
    );
    const s = buildWeekSummary({ date: MON, grid, statusTypes, rosters, shift: DEFAULT_SHIFT });
    expect(s.byType.map((t) => [t.status.code, t.count])).toEqual([["OFF", 2], ["SICK", 2]]);
    expect(s.totalLate).toBe(1);
    expect(s.byEmployee.find((e) => e.name === "Ana")).toMatchObject({ lateArrivals: 1, counts: { "st-OFF": 2 } });
    expect(s.emptyDays.map((d) => d.date)).toContain(MON);
    expect(s.emptyDays.find((d) => d.date === MON)!.departments).toEqual(["Botellería"]);
    expect(s.range).toBe("28 sep – 4 oct");
  });
});

describe("exportación visual", () => {
  it("color de departamento → emoji", () => {
    expect(colorEmoji("#ff3b30")).toBe("🟥");
    expect(colorEmoji("#34c759")).toBe("🟩");
    expect(colorEmoji("#007aff")).toBe("🟦");
    expect(colorEmoji("#ffcc00")).toBe("🟨");
    expect(colorEmoji("#8e8e93")).toBe("⬛");
    expect(colorEmoji("nada")).toBe("⬜");
  });
  it("faltan = les tocaba trabajar y no han venido; fiesta, vacaciones y bajas aparte", () => {
    const employees = [emp("Jorge"), emp("Mike"), emp("Mikael"), emp("Fran"), emp("Dani"), emp("Ana")];
    const entries = [
      entry("Jorge", MON, WORK, { actualStatusTypeId: SICK.id }),
      entry("Mike", MON, WORK, { actualStatusTypeId: OFF.id, reason: "No avisa" }),
      entry("Mikael", MON, ABSENT),
      entry("Fran", MON, OFF),
      entry("Dani", MON, SICK, { reason: "Gripe" }),
      entry("Ana", MON, WORK),
    ];
    const roster = getDayRoster({ date: MON, employees, entries, departments, statusTypes });
    const m = buildShareModel(buildDayReport({ roster, shift: DEFAULT_SHIFT, sections: [], departments }));
    expect(m.off).toEqual(["Fran"]);
    expect(m.away).toEqual([{ label: "Baja laboral", members: [{ name: "Dani", reason: "Gripe" }] }]);
    expect(m.missing.map((x) => x.name).sort()).toEqual(["Jorge", "Mikael", "Mike"]);
    expect(m.counts).toEqual({ working: 1, off: 1, away: 1, missing: 3 });
    const t = shareModelToText(m);
    expect(t).toContain("Mike (No avisa)");
    expect(t).toContain("Baja laboral: Dani (Gripe)");
    const order = ["TRABAJAN", "FIESTA", "VACACIONES Y BAJAS", "FALTAN (3)"].map((k) => t.indexOf(k));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBeGreaterThan(0);
  });
});

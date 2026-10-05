import { describe, expect, it } from "vitest";
import { type HistoryItem, groupHistory, historyCounts, historyToText } from "@/lib/employee-history";
import { entryHistoryItems } from "@/lib/employee-history-entry";
import { DEFAULT_SHIFT } from "@/lib/report";
import { type DayEntryLite, type EmployeeLite, type StatusTypeLite, getEffectiveDay } from "@/lib/schedule";

const st = (code: string, label: string, isWorking: boolean): StatusTypeLite => ({
  id: `st-${code}`, code, label, color: "#123456", isWorking, sortOrder: 0,
});
const WORK = st("WORK", "Trabaja", true);
const OFF = st("OFF", "Fiesta", false);
const SICK = st("SICK", "Baja laboral", false);
const ABSENT = st("ABSENT", "Falta", false);
const statusTypes = [WORK, OFF, SICK, ABSENT];
const ana: EmployeeLite = { id: "ana", name: "Ana", defaultDepartmentId: null, sortOrder: 0, fixedDaysOff: [], active: true };
const entry = (date: string, s: StatusTypeLite, o: Partial<DayEntryLite> = {}): DayEntryLite => ({
  employeeId: "ana", date, statusTypeId: s.id, departmentId: null, reason: null, note: null,
  arrivedAt: null, leftAt: null, timeReason: null, segments: [], ...o,
});
const items = (e: DayEntryLite) => entryHistoryItems(getEffectiveDay(ana, e.date, e, statusTypes), DEFAULT_SHIFT);

describe("apuntes de una noche", () => {
  it("falta: tocaba trabajar y no vino, o «Falta» en el planning", () => {
    expect(items(entry("2026-10-01", WORK, { actualStatusTypeId: SICK.id, reason: "Gripe" }))).toMatchObject([
      { kind: "absence", label: "Falta", text: "No vino (Baja laboral) — Gripe" },
    ]);
    expect(items(entry("2026-10-02", ABSENT))[0]).toMatchObject({ label: "Falta" });
  });
  it("baja prevista sale como ausencia; fiesta sin motivo no se apunta", () => {
    expect(items(entry("2026-10-03", SICK, { reason: "Espalda" }))).toMatchObject([{ label: "Baja laboral", text: "Espalda" }]);
    expect(items(entry("2026-10-04", OFF))).toEqual([]);
  });
  it("horarios, horas extra y nota del día", () => {
    const r = items(entry("2026-10-05", WORK, { arrivedAt: "22:15", leftAt: "07:30", timeReason: "Tren", extraMinutes: 60, extraNote: "Camión", note: "Muy bien" }));
    expect(r.map((i) => [i.label, i.text])).toEqual([
      ["Llega tarde", "a las 22:15 (+45 min) — Tren"],
      ["Se queda más", "se queda 1 h más (sale a las 07:30) — Tren"],
      ["Horas extra", "+1 h — Camión"],
      ["Nota del día", "Muy bien"],
    ]);
  });
});

describe("historial agrupado", () => {
  const all: HistoryItem[] = [
    { date: "2026-09-28", kind: "night-note", label: "Nota", text: "Habla con el jefe", color: "#000" },
    { date: "2026-10-05", kind: "absence", label: "Falta", text: "No vino", color: "#f00" },
    { date: "2026-10-05", kind: "file-note", time: "23:10", label: "Conversación", text: "Avisado por llegar tarde", color: "#00f" },
    { date: "2025-12-24", kind: "report", label: "Aviso", text: "Rotura de palé", color: "#0af", photos: 2 },
  ];
  it("por noche, más reciente primero, notas antes que incidencias", () => {
    const days = groupHistory(all, 2026);
    expect(days.map((d) => d.date)).toEqual(["2026-10-05", "2026-09-28", "2025-12-24"]);
    expect(days[0]!.items.map((i) => i.kind)).toEqual(["file-note", "absence"]);
    expect(days[2]!.title).toMatch(/2025$/);
    expect(historyCounts(days).map((c) => c.kind)).toEqual(["file-note", "night-note", "report", "absence"]);
  });
  it("búsqueda sin acentos ni mayúsculas", () => {
    expect(groupHistory(all, 2026, "PALE").map((d) => d.date)).toEqual(["2025-12-24"]);
    expect(groupHistory(all, 2026, "conversacion")[0]!.items).toHaveLength(1);
  });
  it("texto para exportar", () => {
    const t = historyToText("Ana", groupHistory(all, 2026));
    expect(t).toContain("👤 HISTORIAL DE ANA");
    expect(t).toContain("4 apuntes");
    expect(t).toContain("• 23:10 · Conversación: Avisado por llegar tarde");
    expect(t).toContain("• Aviso: Rotura de palé (📷 2)");
    expect(t.indexOf("Falta")).toBeLessThan(t.indexOf("Habla con el jefe"));
  });
});

import { describe, expect, it } from "vitest";
import { absenceSyncAction, isMissedDay, notifiedLabel } from "@/lib/absence";
import { absenceHistoryItem, mergeAbsenceItems } from "@/lib/employee-history-entry";
import type { StatusTypeLite } from "@/lib/schedule";

const st = (code: string, isWorking: boolean): StatusTypeLite => ({ id: code, code, label: code, color: "#000", isWorking, sortOrder: 0 });
const WORK = st("WORK", true), OFF = st("OFF", false), ABSENT = st("ABSENT", false), SICK = st("SICK", false);
const day = (status: StatusTypeLite, planned: StatusTypeLite | null = null) => ({ status, planned, isWorking: status.isWorking });

describe("qué es una falta", () => {
  it("tocaba trabajar y no vino, o «Falta» en el planning", () => {
    expect(isMissedDay(day(ABSENT, WORK))).toBe(true);
    expect(isMissedDay(day(SICK, WORK))).toBe(true);
    expect(isMissedDay(day(ABSENT))).toBe(true);
    expect(isMissedDay(day(OFF))).toBe(false);
    expect(isMissedDay(day(SICK))).toBe(false); // baja prevista: no es falta
    expect(isMissedDay(day(WORK))).toBe(false);
  });
});

describe("registro de faltas: queda constancia", () => {
  it("se apunta al faltar", () => {
    expect(absenceSyncAction({ before: day(WORK), after: day(ABSENT, WORK), source: "hoy" })).toBe("upsert");
    expect(absenceSyncAction({ before: day(WORK), after: day(ABSENT), source: "semana" })).toBe("upsert");
  });
  it("si en Semana se cambia a fiesta NO se borra: se anota cómo se resolvió", () => {
    expect(absenceSyncAction({ before: day(ABSENT), after: day(OFF), source: "semana" })).toBe("resolve");
    expect(absenceSyncAction({ before: day(ABSENT, WORK), after: day(OFF), source: "semana" })).toBe("resolve");
  });
  it("si en Hoy se corrige a «ha venido» era un error y se quita (si no estaba resuelta)", () => {
    expect(absenceSyncAction({ before: day(ABSENT, WORK), after: day(WORK), source: "hoy" })).toBe("delete-unresolved");
  });
  it("cambios que no tienen que ver con faltas no tocan el registro", () => {
    expect(absenceSyncAction({ before: day(WORK), after: day(OFF), source: "semana" })).toBe("none");
  });
});

describe("historial del empleado", () => {
  it("la falta dice si avisó y cómo se resolvió", () => {
    const it1 = absenceHistoryItem({ date: "2026-10-09", statusLabel: "Falta", reason: "Médico", notified: false, resolutionNote: "cambiada por su fiesta del sábado 10 oct" });
    expect(it1.label).toBe("Falta sin avisar");
    expect(it1.text).toBe("No vino (Falta) — Médico · No avisó · después: cambiada por su fiesta del sábado 10 oct");
    expect(absenceHistoryItem({ date: "2026-10-09", statusLabel: "Falta", reason: null, notified: true, resolutionNote: null }).text).toBe("No vino (Falta) · Avisó");
    expect(notifiedLabel(null)).toBe("Sin indicar si avisó");
  });
  it("no se repite: la del registro sustituye a la de la noche", () => {
    const night = [
      { date: "2026-10-09", kind: "absence" as const, label: "Falta", text: "No vino (Falta)", color: "#f00" },
      { date: "2026-10-09", kind: "note" as const, label: "Nota", text: "Llamó tarde", color: "#000" },
    ];
    const logged = [absenceHistoryItem({ date: "2026-10-09", statusLabel: "Falta", reason: null, notified: true, resolutionNote: null })];
    const merged = mergeAbsenceItems(night, logged);
    expect(merged.filter((i) => i.kind === "absence")).toHaveLength(1);
    expect(merged.map((i) => i.label)).toEqual(["Nota", "Falta"]);
  });
});

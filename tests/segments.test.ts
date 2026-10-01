import { describe, expect, it } from "vitest";
import {
  applyEntryPatch, isEntryRedundant, leftKind, minutesFromShiftStart, nextSegmentStart,
  shiftLength, sortSegments, validateSegmentSpan,
} from "@/lib/segments";
import type { DayEntryLite, EmployeeLite, StatusTypeLite } from "@/lib/schedule";

const shift = { shiftStart: "21:30", shiftEnd: "06:30" };
const st = (code: string, isWorking: boolean): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder: 0,
});
const statusTypes = [st("WORK", true), st("OFF", false), st("SICK", false)];
const emp: EmployeeLite = {
  id: "e1", name: "E1", defaultDepartmentId: "d1", sortOrder: 0, fixedDaysOff: [5], active: true,
};
const MON = "2026-09-28";
const SAT = "2026-10-03";
const seg = (id: string, start: string, end: string) => ({
  id, sectionId: null, label: id, start, end, note: null, sortOrder: 0,
});

describe("minutos desde inicio de turno", () => {
  it("cruza la medianoche", () => {
    expect(minutesFromShiftStart("21:30", "21:30")).toBe(0);
    expect(minutesFromShiftStart("00:00", "21:30")).toBe(150);
    expect(minutesFromShiftStart("06:30", "21:30")).toBe(540);
    expect(shiftLength(shift)).toBe(540);
  });
  it("ordena tramos tras medianoche después de los de la tarde", () => {
    const s = sortSegments([seg("b", "00:30", "05:00"), seg("a", "21:30", "00:30")], "21:30");
    expect(s.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.map((x) => x.sortOrder)).toEqual([0, 1]);
  });
});

describe("validateSegmentSpan", () => {
  it("acepta tramos válidos que cruzan medianoche", () => {
    expect(validateSegmentSpan([], { start: "21:30", end: "05:00" }, shift)).toBeNull();
    expect(validateSegmentSpan([seg("a", "21:30", "05:00")], { start: "05:00", end: "06:30" }, shift)).toBeNull();
  });
  it("rechaza fin anterior o igual al inicio", () => {
    expect(validateSegmentSpan([], { start: "05:00", end: "23:00" }, shift)).toMatch(/posterior/);
    expect(validateSegmentSpan([], { start: "05:00", end: "05:00" }, shift)).toMatch(/posterior/);
  });
  it("rechaza fuera de turno", () => {
    expect(validateSegmentSpan([], { start: "21:30", end: "07:30" }, shift)).toMatch(/Fuera/);
    expect(validateSegmentSpan([], { start: "10:00", end: "12:00" }, shift)).toMatch(/Fuera/);
  });
  it("detecta solapes, ignorando el propio tramo", () => {
    const others = [seg("a", "21:30", "05:00")];
    expect(validateSegmentSpan(others, { start: "04:00", end: "06:30" }, shift)).toMatch(/solapa/);
    expect(validateSegmentSpan(others, { id: "a", start: "21:30", end: "04:00" }, shift)).toBeNull();
  });
  it("rechaza formato inválido", () => {
    expect(validateSegmentSpan([], { start: "", end: "05:00" }, shift)).toMatch(/Indica/);
  });
});

describe("nextSegmentStart", () => {
  it("inicio de turno si no hay tramos, o fin del último", () => {
    expect(nextSegmentStart([], shift)).toBe("21:30");
    expect(nextSegmentStart([seg("a", "21:30", "05:00"), seg("b", "00:00", "01:00")], shift)).toBe("05:00");
  });
});

describe("leftKind", () => {
  it("distingue quedarse más de irse antes", () => {
    expect(leftKind("07:30", shift)).toBe("more");
    expect(leftKind("04:00", shift)).toBe("less");
  });
});

describe("applyEntryPatch / isEntryRedundant", () => {
  it("crea con valores efectivos y detecta redundancia", () => {
    const e = applyEntryPatch(undefined, emp, MON, statusTypes, { kind: "department", departmentId: "d1" }, "21:30");
    expect(e.statusTypeId).toBe("st-WORK");
    expect(e.departmentId).toBeNull();
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(true);
  });
  it("día fijo de fiesta: OFF es el patrón, WORK no", () => {
    const off = applyEntryPatch(undefined, emp, SAT, statusTypes, { kind: "note", note: "" }, "21:30");
    expect(off.statusTypeId).toBe("st-OFF");
    expect(isEntryRedundant(off, emp, SAT, statusTypes)).toBe(true);
    const work = applyEntryPatch(off, emp, SAT, statusTypes, { kind: "status", statusTypeId: "st-WORK" }, "21:30");
    expect(isEntryRedundant(work, emp, SAT, statusTypes)).toBe(false);
  });
  it("horas extra o su motivo hacen no redundante el entry", () => {
    let e = applyEntryPatch(undefined, emp, MON, statusTypes, { kind: "overtime", extraMinutes: 60, extraNote: " camión " }, "21:30");
    expect(e.extraMinutes).toBe(60);
    expect(e.extraNote).toBe("camión");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
    e = applyEntryPatch(e, emp, MON, statusTypes, { kind: "overtime", extraMinutes: 0, extraNote: "solo motivo" }, "21:30");
    expect(e.extraMinutes).toBeNull();
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
    e = applyEntryPatch(e, emp, MON, statusTypes, { kind: "overtime", extraMinutes: 0, extraNote: "" }, "21:30");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(true);
  });
  it("el motivo se limpia al volver a trabajar", () => {
    let e = applyEntryPatch(undefined, emp, MON, statusTypes, { kind: "status", statusTypeId: "st-SICK", reason: " gripe " }, "21:30");
    expect(e.reason).toBe("gripe");
    e = applyEntryPatch(e, emp, MON, statusTypes, { kind: "status", statusTypeId: "st-WORK" }, "21:30");
    expect(e.reason).toBeNull();
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(true);
  });
  it("tramos, notas y horarios hacen no redundante; quitarlos vuelve a serlo", () => {
    let e: DayEntryLite = applyEntryPatch(undefined, emp, MON, statusTypes, { kind: "segmentAdd", segment: seg("a", "21:30", "05:00") }, "21:30");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
    e = applyEntryPatch(e, emp, MON, statusTypes, { kind: "segmentDelete", id: "a" }, "21:30");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(true);
    e = applyEntryPatch(e, emp, MON, statusTypes, { kind: "times", arrivedAt: "22:15", leftAt: null, timeReason: null }, "21:30");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
    e = applyEntryPatch(e, emp, MON, statusTypes, { kind: "times", arrivedAt: null, leftAt: null, timeReason: "  " }, "21:30");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(true);
  });
  it("departamento distinto del habitual no es redundante", () => {
    const e = applyEntryPatch(undefined, emp, MON, statusTypes, { kind: "department", departmentId: "d2" }, "21:30");
    expect(e.departmentId).toBe("d2");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
  });
});

describe("pasar lista", () => {
  const work = (patch: Parameters<typeof applyEntryPatch>[4], cur: DayEntryLite | null = null) =>
    applyEntryPatch(cur, emp, MON, statusTypes, patch, shift.shiftStart);

  it("marcar 'ha venido' guarda la entrada aunque coincida con el patrón", () => {
    const e = work({ kind: "attendance", present: true });
    expect(e.present).toBe(true);
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
  });
  it("deshacer vuelve a dejarla redundante", () => {
    const e = work({ kind: "attendance", present: false }, work({ kind: "attendance", present: true }));
    expect(e.present).toBeNull();
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(true);
  });
  it("pasar a un estado de ausencia quita la confirmación", () => {
    const e = work({ kind: "status", statusTypeId: "st-SICK", reason: "fiebre" }, work({ kind: "attendance", present: true }));
    expect(e.present).toBeNull();
    expect(e.reason).toBe("fiebre");
  });
  it("no se puede confirmar a quien no trabaja", () => {
    const off = applyEntryPatch(null, emp, SAT, statusTypes, { kind: "attendance", present: true }, shift.shiftStart);
    expect(off.present).toBeNull();
  });
});

describe("avisos de planning", () => {
  const apply = (patch: Parameters<typeof applyEntryPatch>[4], cur: DayEntryLite | null = null) =>
    applyEntryPatch(cur, emp, MON, statusTypes, patch, shift.shiftStart);

  it("Hoy cambia Trabaja → Baja: recuerda el planning y no es redundante", () => {
    const e = apply({ kind: "status", statusTypeId: "st-SICK", reason: null });
    expect(e.plannedStatusTypeId).toBe("st-WORK");
    expect(isEntryRedundant(e, emp, MON, statusTypes)).toBe(false);
  });
  it("volver al estado del planning quita el aviso", () => {
    const sick = apply({ kind: "status", statusTypeId: "st-SICK", reason: null });
    const back = apply({ kind: "status", statusTypeId: "st-WORK", reason: null }, sick);
    expect(back.plannedStatusTypeId).toBeNull();
    expect(isEntryRedundant(back, emp, MON, statusTypes)).toBe(true);
  });
  it("cambios encadenados conservan el planning original", () => {
    const off = apply({ kind: "status", statusTypeId: "st-OFF", reason: null });
    const sick = apply({ kind: "status", statusTypeId: "st-SICK", reason: null }, off);
    expect(sick.plannedStatusTypeId).toBe("st-WORK");
  });
});

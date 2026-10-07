import { describe, expect, it } from "vitest";
import { formatStamp, madridInstant, madridTime } from "@/lib/dates";
import { type NoteView, groupNotesByWho, noteLabel, noteLine, noteTypeOf, noteTypeToDb, noteWho, sortNotes } from "@/lib/notes";
import { saveNoteSchema } from "@/lib/notes-schema";
import { photoCountLabel, purgeCutoff } from "@/lib/reports";

const photo = (n: number) => ({
  url: `/api/files/reports/p${n}.jpg`,
  pathname: `reports/p${n}.jpg`,
  width: 1600,
  height: 1200,
  size: 300_000,
});

const note = (o: Partial<NoteView> = {}): NoteView => ({
  id: "n", date: "2026-10-05", time: null, type: "NOTE", done: false, text: "Texto",
  employeeId: null, employeeName: null, departmentId: null, departmentName: null, sectionId: null, sectionName: null, photos: [],
  ...o,
});

describe("saveNoteSchema", () => {
  it("acepta una nota válida y normaliza opcionales", () => {
    const r = saveNoteSchema.parse({ date: "2026-09-29", type: "NOTE", text: "  Palé roto  ", time: "", photos: [photo(1)] });
    expect(r.text).toBe("Palé roto");
    expect(r.time).toBeNull();
    expect(r.employeeId).toBeNull();
    expect(r.sectionId).toBeNull();
    expect(r.photos).toHaveLength(1);
  });
  it("el texto es obligatorio y la hora válida", () => {
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "NOTE", text: "   " }).success).toBe(false);
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "NOTE", text: "x", time: "25:00" }).success).toBe(false);
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "TALK", text: "x", time: "23:40" }).success).toBe(true);
  });
  it("máximo 6 fotos", () => {
    const six = Array.from({ length: 6 }, (_, i) => photo(i));
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "NOTE", text: "x", photos: six }).success).toBe(true);
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "NOTE", text: "x", photos: [...six, photo(9)] }).success).toBe(false);
  });
  it("rechaza fecha inválida, tipo desconocido y fotos con URL/ruta incoherentes", () => {
    expect(saveNoteSchema.safeParse({ date: "29/09/2026", type: "NOTE", text: "x" }).success).toBe(false);
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "REPORT", text: "x" }).success).toBe(false);
    const bad = { ...photo(1), url: "https://evil.example.com/reports/p1.jpg" };
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "NOTE", text: "x", photos: [bad] }).success).toBe(false);
    const traversal = { ...photo(1), pathname: "reports/../.env", url: "/api/files/reports/../.env" };
    expect(saveNoteSchema.safeParse({ date: "2026-09-29", type: "NOTE", text: "x", photos: [traversal] }).success).toBe(false);
  });
});

describe("tipo de nota ↔ BD", () => {
  it("ida y vuelta", () => {
    for (const t of ["NOTE", "TASK", "INCIDENT", "PRAISE", "TALK", "REQUEST"] as const) {
      const db = noteTypeToDb(t);
      expect(noteTypeOf(db.kind, db.category)).toBe(t);
    }
  });
  it("categoría desconocida = nota", () => {
    expect(noteTypeOf("INFO", "RARA")).toBe("NOTE");
    expect(noteTypeOf("TASK", "INCIDENT")).toBe("TASK");
  });
});

describe("textos", () => {
  it("quién, etiqueta y línea para compartir", () => {
    expect(noteWho(note())).toBe("General");
    expect(noteWho(note({ employeeName: "Ana", departmentName: "Droguería" }))).toBe("Ana · Droguería");
    expect(noteLabel(note({ type: "TASK", done: true }))).toBe("Tarea hecha");
    expect(noteLabel(note({ type: "PRAISE" }))).toBe("Felicitación");
    expect(
      noteLine(note({ employeeName: "Gerard", text: "Palé roto\nen pasillo", sectionName: "Cerveza", photos: [1, 2].map((n) => ({ id: String(n), url: "u", width: 1, height: 1, size: 1 })) })),
    ).toBe("Gerard: Palé roto en pasillo [Cerveza] (📷 2)");
    expect(noteLine(note({ type: "TASK", text: "Inventario" }))).toBe("☐ Inventario");
    expect(noteLine(note({ type: "INCIDENT", text: "Grita", employeeName: "Ana" }), false)).toBe("Incidencia: Grita");
  });
  it("las generales primero", () => {
    const a = note({ id: "a", employeeId: "e", employeeName: "Ana" });
    const b = note({ id: "b" });
    expect(sortNotes([a, b]).map((n) => n.id)).toEqual(["b", "a"]);
  });
  it("singular de fotos", () => {
    expect(photoCountLabel(1)).toBe("1 foto");
    expect(photoCountLabel(3)).toBe("3 fotos");
  });
});

describe("purgeCutoff", () => {
  it("resta meses naturales", () => {
    expect(purgeCutoff("2026-09-30", 6)).toBe("2026-03-30");
    expect(purgeCutoff("2026-01-15", 2)).toBe("2025-11-15");
  });
  it("ajusta al último día del mes", () => {
    expect(purgeCutoff("2026-03-31", 1)).toBe("2026-02-28");
    expect(purgeCutoff("2024-05-31", 3)).toBe("2024-02-29");
  });
  it("cruza años", () => {
    expect(purgeCutoff("2026-06-10", 12)).toBe("2025-06-10");
    expect(purgeCutoff("2026-06-10", 18)).toBe("2024-12-10");
  });
});

describe("madridInstant", () => {
  it("verano (UTC+2) e invierno (UTC+1)", () => {
    expect(madridInstant("2026-09-29", "23:40").toISOString()).toBe("2026-09-29T21:40:00.000Z");
    expect(madridInstant("2026-12-15", "23:40").toISOString()).toBe("2026-12-15T22:40:00.000Z");
  });
  it("ida y vuelta, también tras cambios de hora", () => {
    for (const [d, t] of [["2026-03-29", "01:30"], ["2026-03-29", "03:30"], ["2026-10-25", "01:30"], ["2026-10-25", "04:00"], ["2026-01-01", "00:00"]] as const) {
      expect(madridTime(madridInstant(d, t))).toBe(t);
    }
  });
  it("formatea la marca de tiempo en Madrid", () => {
    expect(formatStamp(madridInstant("2026-09-29", "23:40"))).toBe("Mar 29 sep · 23:40");
  });
});

describe("groupNotesByWho", () => {
  it("junta las de la misma persona, generales primero, en orden de aparición", () => {
    const g = groupNotesByWho([
      note({ id: "1", employeeId: "c", employeeName: "Claudia", departmentId: "p", departmentName: "Palets" }),
      note({ id: "2", employeeId: "j", employeeName: "Juan" }),
      note({ id: "3" }),
      note({ id: "4", employeeId: "c", employeeName: "Claudia" }),
      note({ id: "5", departmentId: "d", departmentName: "Droguería" }),
      note({ id: "6" }),
    ]);
    expect(g.map((x) => [x.who, x.notes.map((n) => n.id)])).toEqual([
      ["General", ["3", "6"]],
      ["Claudia", ["1", "4"]],
      ["Juan", ["2"]],
      ["Droguería", ["5"]],
    ]);
  });
});

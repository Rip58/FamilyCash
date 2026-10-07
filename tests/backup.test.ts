import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, parseBackup } from "@/lib/backup";

describe("copia de seguridad", () => {
  it("incluye todas las tablas del esquema (si añades un modelo, añádelo a BACKUP_TABLES)", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]!.charAt(0).toLowerCase() + m[1]!.slice(1));
    expect([...BACKUP_TABLES].sort()).toEqual(models.sort());
  });
  it("valida el formato", () => {
    const tables = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
    expect(() => parseBackup({ format: "otra-cosa", tables })).toThrow();
    expect(() => parseBackup({ format: "familycash-backup", version: 1, tables: { ...tables, employee: "x" } })).toThrow(/employee/);
    expect(parseBackup({ format: "familycash-backup", version: 1, createdAt: "x", tables }).version).toBe(1);
  });
  it("acepta copias anteriores a una tabla nueva (la deja vacía)", () => {
    const tables: Record<string, unknown[]> = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
    delete tables.planogram;
    expect(parseBackup({ format: "familycash-backup", version: 1, tables }).tables.planogram).toEqual([]);
  });
});

describe("copias de la versión 1 (antes de unificar las notas)", () => {
  it("pasan la nota del día, notas de Hoy, de ficha, avisos y peticiones a nightNote", () => {
    const tables: Record<string, unknown[]> = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
    tables.settings = [{ id: 1, dayRolloverHour: 12 }];
    tables.dayNote = [{ date: "2026-09-28T00:00:00.000Z", text: " Camión tarde " }, { date: "2026-09-29T00:00:00.000Z", text: "  " }];
    tables.dayEntry = [{ id: "d1", employeeId: "e", date: "2026-09-28T00:00:00.000Z", note: "Dolor de espalda", updatedAt: "2026-09-28T22:00:00.000Z" }];
    tables.employeeNote = [{ id: "f1", employeeId: "e", occurredAt: "2026-10-06T01:30:00.000Z", category: "INCIDENT", text: "Gritos", createdAt: "x", updatedAt: "x" }];
    tables.employeeNotePhoto = [{ id: "fp", noteId: "f1", url: "/api/files/reports/a.webp", pathname: "reports/a.webp", width: 1, height: 1 }];
    tables.report = [{ id: "r1", date: "2026-10-05T00:00:00.000Z", employeeId: null, sectionId: "s", text: "Palé roto", createdAt: "2026-10-05T23:10:00.000Z" }];
    tables.reportPhoto = [{ id: "rp", reportId: "r1", url: "/api/files/reports/b.webp", pathname: "reports/b.webp", width: 1, height: 1 }];
    tables.leaveRequest = [{ id: "l1", employeeId: "e", type: "SWAP_OFF", dateFrom: "2026-10-08T00:00:00.000Z", dateTo: "2026-10-09T00:00:00.000Z", note: "boda", requestedAt: "2026-10-01T00:00:00.000Z", status: "APPROVED", createdAt: "x" }];
    const b = parseBackup({ format: "familycash-backup", version: 1, tables });
    const notes = b.tables.nightNote as Record<string, unknown>[];
    expect(notes.map((n) => [n.id, n.category, n.text])).toEqual([
      ["dn_20260928", "NOTE", "Camión tarde"],
      ["en_d1", "NOTE", "Dolor de espalda"],
      ["fn_f1", "INCIDENT", "Gritos"],
      ["rp_r1", "NOTE", "Palé roto"],
      ["lr_l1", "REQUEST", "Cambio de fiesta: librar el 09/10 en vez del 08/10 — boda (aprobada)"],
    ]);
    // 03:30 en Madrid del día 6 = noche del 5.
    expect(notes[2]).toMatchObject({ date: "2026-10-05T00:00:00.000Z", time: "03:30" });
    expect(notes[3]).toMatchObject({ time: "01:10", sectionId: "s" });
    expect((b.tables.nightNotePhoto as Record<string, unknown>[]).map((p) => [p.id, p.noteId])).toEqual([["fp", "fn_f1"], ["rp", "rp_r1"]]);
    expect(b.tables.dayEntry[0]).not.toHaveProperty("note");
    expect(b.tables).not.toHaveProperty("report");
  });
});

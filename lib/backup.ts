/**
 * Copia completa de la base de datos en JSON (botón de Ajustes → Datos) y restauración
 * (scripts/restore-backup.ts). Las tablas van en orden de dependencias: restaurar en este
 * orden respeta las claves ajenas.
 */
import { addDays, madridParts } from "@/lib/dates";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

export const BACKUP_FORMAT = "familycash-backup";
/** 2: notas unificadas (NightNote + NightNotePhoto). Las copias 1 se convierten al restaurar (`upgradeV1`). */
export const BACKUP_VERSION = 2;

export const BACKUP_TABLES = [
  "settings",
  "payrollSettings",
  "department",
  "statusType",
  "section",
  "employee",
  "dayEntry",
  "workSegment",
  "protocol",
  "protocolStep",
  "shelfLocation",
  "planogram",
  "planogramPhoto",
  "payrollPeriod",
  "payslip",
  "nightNote",
  "nightNotePhoto",
  "absence",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
type Row = Record<string, unknown>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  counts: Record<BackupTable, number>;
  tables: Record<BackupTable, Row[]>;
}

/** Lee todas las tablas (las fechas salen como ISO al serializar a JSON). */
export async function exportBackup(db: PrismaClient): Promise<BackupFile> {
  const read: Record<BackupTable, () => Promise<Row[]>> = {
    settings: () => db.settings.findMany(),
    payrollSettings: () => db.payrollSettings.findMany(),
    department: () => db.department.findMany(),
    statusType: () => db.statusType.findMany(),
    section: () => db.section.findMany(),
    employee: () => db.employee.findMany(),
    dayEntry: () => db.dayEntry.findMany(),
    workSegment: () => db.workSegment.findMany(),
    protocol: () => db.protocol.findMany(),
    protocolStep: () => db.protocolStep.findMany(),
    shelfLocation: () => db.shelfLocation.findMany(),
    planogram: () => db.planogram.findMany(),
    planogramPhoto: () => db.planogramPhoto.findMany(),
    payrollPeriod: () => db.payrollPeriod.findMany(),
    payslip: () => db.payslip.findMany(),
    nightNote: () => db.nightNote.findMany(),
    nightNotePhoto: () => db.nightNotePhoto.findMany(),
    absence: () => db.absence.findMany(),
  };
  const tables = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) tables[t] = await read[t]();
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t].length])) as Record<BackupTable, number>;
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), counts, tables };
}

/** Comprueba que un JSON es una copia válida (formato y todas las tablas). */
export function parseBackup(data: unknown): BackupFile {
  const b = data as Partial<BackupFile> | null;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== "object" || !b.tables) {
    throw new Error("No es un archivo de copia de FamilyCash.");
  }
  if ((b.version ?? 0) > BACKUP_VERSION) throw new Error(`Copia de una versión más nueva (${b.version}).`);
  const tables = b.tables as Partial<Record<BackupTable, unknown>>;
  if ((b.version ?? 1) < 2) upgradeV1(tables as Record<string, unknown>);
  for (const t of BACKUP_TABLES) {
    // Copias anteriores a una tabla nueva: esa tabla se restaura vacía.
    if (tables[t] === undefined) tables[t] = [];
    else if (!Array.isArray(tables[t])) throw new Error(`La tabla ${t} de la copia no es válida.`);
  }
  return b as BackupFile;
}

/**
 * Inserta la copia en una base de datos sin datos (esquema ya migrado), en una transacción.
 * Antes borra las filas que crean las propias migraciones (estado ABSENT, ajustes de nómina…).
 */
export async function restoreBackup(db: PrismaClient, backup: BackupFile): Promise<Record<BackupTable, number>> {
  const t = backup.tables;
  /* eslint-disable @typescript-eslint/no-explicit-any -- filas de la copia: mismas columnas que el esquema */
  const write: Record<BackupTable, (tx: Prisma.TransactionClient) => Promise<{ count: number }>> = {
    settings: (tx) => tx.settings.createMany({ data: t.settings as any }),
    payrollSettings: (tx) => tx.payrollSettings.createMany({ data: t.payrollSettings as any }),
    department: (tx) => tx.department.createMany({ data: t.department as any }),
    statusType: (tx) => tx.statusType.createMany({ data: t.statusType as any }),
    section: (tx) => tx.section.createMany({ data: t.section as any }),
    employee: (tx) => tx.employee.createMany({ data: t.employee as any }),
    dayEntry: (tx) => tx.dayEntry.createMany({ data: t.dayEntry as any }),
    workSegment: (tx) => tx.workSegment.createMany({ data: t.workSegment as any }),
    protocol: (tx) => tx.protocol.createMany({ data: t.protocol as any }),
    protocolStep: (tx) => tx.protocolStep.createMany({ data: t.protocolStep as any }),
    shelfLocation: (tx) => tx.shelfLocation.createMany({ data: t.shelfLocation as any }),
    planogram: (tx) => tx.planogram.createMany({ data: t.planogram as any }),
    planogramPhoto: (tx) => tx.planogramPhoto.createMany({ data: t.planogramPhoto as any }),
    payrollPeriod: (tx) => tx.payrollPeriod.createMany({ data: t.payrollPeriod as any }),
    payslip: (tx) => tx.payslip.createMany({ data: t.payslip as any }),
    nightNote: (tx) => tx.nightNote.createMany({ data: t.nightNote as any }),
    nightNotePhoto: (tx) => tx.nightNotePhoto.createMany({ data: t.nightNotePhoto as any }),
    absence: (tx) => tx.absence.createMany({ data: (t.absence ?? []) as any }),
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const clear: Record<BackupTable, (tx: Prisma.TransactionClient) => Promise<unknown>> = {
    settings: (tx) => tx.settings.deleteMany(),
    payrollSettings: (tx) => tx.payrollSettings.deleteMany(),
    department: (tx) => tx.department.deleteMany(),
    statusType: (tx) => tx.statusType.deleteMany(),
    section: (tx) => tx.section.deleteMany(),
    employee: (tx) => tx.employee.deleteMany(),
    dayEntry: (tx) => tx.dayEntry.deleteMany(),
    workSegment: (tx) => tx.workSegment.deleteMany(),
    protocol: (tx) => tx.protocol.deleteMany(),
    protocolStep: (tx) => tx.protocolStep.deleteMany(),
    shelfLocation: (tx) => tx.shelfLocation.deleteMany(),
    planogram: (tx) => tx.planogram.deleteMany(),
    planogramPhoto: (tx) => tx.planogramPhoto.deleteMany(),
    payrollPeriod: (tx) => tx.payrollPeriod.deleteMany(),
    payslip: (tx) => tx.payslip.deleteMany(),
    nightNote: (tx) => tx.nightNote.deleteMany(),
    nightNotePhoto: (tx) => tx.nightNotePhoto.deleteMany(),
    absence: (tx) => tx.absence.deleteMany(),
  };
  return db.$transaction(
    async (tx) => {
      for (const name of [...BACKUP_TABLES].reverse()) await clear[name](tx);
      const done = {} as Record<BackupTable, number>;
      for (const name of BACKUP_TABLES) done[name] = (await write[name](tx)).count;
      return done;
    },
    { timeout: 120_000 },
  );
}

const ddmm = (iso: unknown) => {
  const d = String(iso).slice(0, 10);
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
};
const hhmm = (p: { hour: number; minute: number }) => `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
const LEAVE_TEXT: Record<string, string> = { VACATION: "Vacaciones", PAID_OFF: "Permiso" };
const STATUS_TEXT: Record<string, string> = { APPROVED: " (aprobada)", DENIED: " (denegada)" };

/**
 * Copias de la versión 1 (antes de unificar las notas): la nota del día, las notas de empleado de Hoy, las notas de
 * ficha, los avisos con foto y las peticiones pasan a `nightNote` / `nightNotePhoto`, igual que la migración
 * `unified_notes`. Modifica `tables`.
 */
export function upgradeV1(tables: Record<string, unknown>): void {
  const arr = (k: string) => (Array.isArray(tables[k]) ? (tables[k] as Row[]) : []);
  const notes: Row[] = [...arr("nightNote")];
  const photos: Row[] = [...arr("nightNotePhoto")];
  const rollover = Number(arr("settings")[0]?.dayRolloverHour ?? 12);
  const now = new Date().toISOString();
  for (const d of arr("dayNote")) {
    const text = String(d.text ?? "").trim();
    if (text) notes.push({ id: `dn_${String(d.date).slice(0, 10).replace(/-/g, "")}`, date: d.date, kind: "INFO", category: "NOTE", text, createdAt: d.date, updatedAt: now });
  }
  tables.dayEntry = arr("dayEntry").map(({ note, ...e }) => {
    const text = typeof note === "string" ? note.trim() : "";
    if (text) notes.push({ id: `en_${e.id}`, date: e.date, employeeId: e.employeeId, kind: "INFO", category: "NOTE", text, createdAt: e.updatedAt ?? now, updatedAt: now });
    return e;
  });
  for (const n of arr("employeeNote")) {
    // La noche es la del turno: antes de la hora de cambio de día = noche anterior.
    const at = madridParts(new Date(String(n.occurredAt)));
    const date = at.hour < rollover ? addDays(at.date, -1) : at.date;
    const category = ["NOTE", "INCIDENT", "PRAISE", "TALK"].includes(String(n.category)) ? n.category : "NOTE";
    notes.push({ id: `fn_${n.id}`, date: `${date}T00:00:00.000Z`, time: hhmm(at), employeeId: n.employeeId, kind: "INFO", category, text: n.text, createdAt: n.createdAt, updatedAt: n.updatedAt ?? now });
  }
  for (const p of arr("employeeNotePhoto")) photos.push({ ...withoutKey(p, "noteId"), noteId: `fn_${p.noteId}` });
  for (const r of arr("report")) {
    notes.push({ id: `rp_${r.id}`, date: r.date, time: hhmm(madridParts(new Date(String(r.createdAt)))), employeeId: r.employeeId ?? null, sectionId: r.sectionId ?? null, kind: "INFO", category: "NOTE", text: r.text, createdAt: r.createdAt, updatedAt: r.createdAt });
  }
  for (const p of arr("reportPhoto")) photos.push({ ...withoutKey(p, "reportId"), noteId: `rp_${p.reportId}` });
  for (const r of arr("leaveRequest")) {
    const what =
      r.type === "SWAP_OFF"
        ? `Cambio de fiesta: librar el ${ddmm(r.dateTo)} en vez del ${ddmm(r.dateFrom)}`
        : `${LEAVE_TEXT[String(r.type)] ?? "Petición"} del ${ddmm(r.dateFrom)} al ${ddmm(r.dateTo)}`;
    const note = typeof r.note === "string" && r.note.trim() ? ` — ${r.note.trim()}` : "";
    const answer = typeof r.decisionNote === "string" && r.decisionNote.trim() ? ` · respuesta: ${r.decisionNote.trim()}` : "";
    notes.push({ id: `lr_${r.id}`, date: r.requestedAt, employeeId: r.employeeId, kind: "INFO", category: "REQUEST", text: `${what}${note}${STATUS_TEXT[String(r.status)] ?? ""}${answer}`, createdAt: r.createdAt, updatedAt: r.createdAt });
  }
  for (const k of ["dayNote", "employeeNote", "employeeNotePhoto", "report", "reportPhoto", "leaveRequest"]) delete tables[k];
  tables.nightNote = notes;
  tables.nightNotePhoto = photos;
}

function withoutKey(r: Row, key: string): Row {
  const { [key]: _drop, ...rest } = r;
  void _drop;
  return rest;
}


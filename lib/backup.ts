/**
 * Copia completa de la base de datos en JSON (botón de Ajustes → Datos) y restauración
 * (scripts/restore-backup.ts). Las tablas van en orden de dependencias: restaurar en este
 * orden respeta las claves ajenas.
 */
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";

export const BACKUP_FORMAT = "familycash-backup";
export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = [
  "settings",
  "payrollSettings",
  "department",
  "statusType",
  "section",
  "employee",
  "dayEntry",
  "workSegment",
  "dayNote",
  "protocol",
  "protocolStep",
  "shelfLocation",
  "planogram",
  "planogramPhoto",
  "report",
  "reportPhoto",
  "employeeNote",
  "employeeNotePhoto",
  "leaveRequest",
  "payrollPeriod",
  "payslip",
  "nightNote",
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
    dayNote: () => db.dayNote.findMany(),
    protocol: () => db.protocol.findMany(),
    protocolStep: () => db.protocolStep.findMany(),
    shelfLocation: () => db.shelfLocation.findMany(),
    planogram: () => db.planogram.findMany(),
    planogramPhoto: () => db.planogramPhoto.findMany(),
    report: () => db.report.findMany(),
    reportPhoto: () => db.reportPhoto.findMany(),
    employeeNote: () => db.employeeNote.findMany(),
    employeeNotePhoto: () => db.employeeNotePhoto.findMany(),
    leaveRequest: () => db.leaveRequest.findMany(),
    payrollPeriod: () => db.payrollPeriod.findMany(),
    payslip: () => db.payslip.findMany(),
    nightNote: () => db.nightNote.findMany(),
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
  const leave = t.leaveRequest.map((r) => ({ ...r, appliedChanges: r.appliedChanges ?? Prisma.DbNull }));
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
    dayNote: (tx) => tx.dayNote.createMany({ data: t.dayNote as any }),
    protocol: (tx) => tx.protocol.createMany({ data: t.protocol as any }),
    protocolStep: (tx) => tx.protocolStep.createMany({ data: t.protocolStep as any }),
    shelfLocation: (tx) => tx.shelfLocation.createMany({ data: t.shelfLocation as any }),
    planogram: (tx) => tx.planogram.createMany({ data: t.planogram as any }),
    planogramPhoto: (tx) => tx.planogramPhoto.createMany({ data: t.planogramPhoto as any }),
    report: (tx) => tx.report.createMany({ data: t.report as any }),
    reportPhoto: (tx) => tx.reportPhoto.createMany({ data: t.reportPhoto as any }),
    employeeNote: (tx) => tx.employeeNote.createMany({ data: t.employeeNote as any }),
    employeeNotePhoto: (tx) => tx.employeeNotePhoto.createMany({ data: t.employeeNotePhoto as any }),
    leaveRequest: (tx) => tx.leaveRequest.createMany({ data: leave as any }),
    payrollPeriod: (tx) => tx.payrollPeriod.createMany({ data: t.payrollPeriod as any }),
    payslip: (tx) => tx.payslip.createMany({ data: t.payslip as any }),
    nightNote: (tx) => tx.nightNote.createMany({ data: t.nightNote as any }),
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
    dayNote: (tx) => tx.dayNote.deleteMany(),
    protocol: (tx) => tx.protocol.deleteMany(),
    protocolStep: (tx) => tx.protocolStep.deleteMany(),
    shelfLocation: (tx) => tx.shelfLocation.deleteMany(),
    planogram: (tx) => tx.planogram.deleteMany(),
    planogramPhoto: (tx) => tx.planogramPhoto.deleteMany(),
    report: (tx) => tx.report.deleteMany(),
    reportPhoto: (tx) => tx.reportPhoto.deleteMany(),
    employeeNote: (tx) => tx.employeeNote.deleteMany(),
    employeeNotePhoto: (tx) => tx.employeeNotePhoto.deleteMany(),
    leaveRequest: (tx) => tx.leaveRequest.deleteMany(),
    payrollPeriod: (tx) => tx.payrollPeriod.deleteMany(),
    payslip: (tx) => tx.payslip.deleteMany(),
    nightNote: (tx) => tx.nightNote.deleteMany(),
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

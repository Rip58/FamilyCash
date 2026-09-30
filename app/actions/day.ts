"use server";

/**
 * Server Actions de la pantalla Hoy (reutilizables desde Semana).
 * Un DayEntry solo existe si difiere del patrón: se crea con los valores
 * efectivos actuales la primera vez que se edita y se borra si vuelve a
 * coincidir con el patrón (ver lib/segments.ts).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { type DateStr, isDateStr, toDbDate } from "@/lib/dates";
import { isValidOvertime } from "@/lib/overtime";
import { getSettings } from "@/lib/queries";
import { type DayEntryLite, type EmployeeLite, type StatusTypeLite } from "@/lib/schedule";
import {
  type EntryPatch,
  TIME_RE,
  applyEntryPatch,
  baseEntry,
  isEntryRedundant,
  sortSegments,
  validateSegmentSpan,
} from "@/lib/segments";

export type ActionResult = { ok: true } | { ok: false; error: string };

class UserError extends Error {}

// ---- Esquemas ------------------------------------------------------------

const idSchema = z.string().min(1).max(64);
const dateSchema = z.string().refine((v) => isDateStr(v), "Fecha inválida");
const timeSchema = z.string().regex(TIME_RE, "Hora inválida");
const optTime = z
  .string()
  .nullable()
  .transform((v) => (v === "" ? null : v))
  .pipe(timeSchema.nullable());
const optText = (max: number) => z.string().max(max).nullable();

const base = { employeeId: idSchema, date: dateSchema };

const setStatusSchema = z.object({
  ...base,
  statusTypeId: idSchema,
  reason: optText(200).optional(),
});
const setReasonSchema = z.object({ ...base, reason: optText(200) });
const setDepartmentSchema = z.object({ ...base, departmentId: idSchema.nullable() });
const setTimesSchema = z.object({
  ...base,
  arrivedAt: optTime,
  leftAt: optTime,
  timeReason: optText(200),
});
const extraMinutesSchema = z
  .number()
  .int()
  .refine(isValidOvertime, "Horas extra no válidas (0–720 min, de 15 en 15).");
const setOvertimeSchema = z.object({
  ...base,
  extraMinutes: extraMinutesSchema,
  extraNote: optText(200).optional(),
});
const setOvertimeBulkSchema = z.object({
  date: dateSchema,
  items: z
    .array(z.object({ employeeId: idSchema, extraMinutes: extraMinutesSchema, extraNote: optText(200).optional() }))
    .min(1)
    .max(200),
});
const setNoteSchema = z.object({ ...base, note: optText(500) });
const segmentFields = {
  sectionId: idSchema.nullable(),
  label: z.string().max(60).nullable(),
  start: timeSchema,
  end: timeSchema,
};
const addSegmentSchema = z.object({ ...base, ...segmentFields });
const updateSegmentSchema = z.object({ ...base, segmentId: idSchema, ...segmentFields });
const deleteSegmentSchema = z.object({ ...base, segmentId: idSchema });
const setDayNoteSchema = z.object({ date: dateSchema, text: z.string().max(1000) });

// ---- Utilidades ----------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const SEG_SELECT = { orderBy: { sortOrder: "asc" as const } };

function toLite(
  row: {
    employeeId: string;
    statusTypeId: string;
    departmentId: string | null;
    reason: string | null;
    note: string | null;
    arrivedAt: string | null;
    leftAt: string | null;
    timeReason: string | null;
    extraMinutes: number | null;
    extraNote: string | null;
    segments: {
      id: string;
      sectionId: string | null;
      label: string | null;
      start: string;
      end: string;
      note: string | null;
      sortOrder: number;
    }[];
  },
  date: DateStr,
): DayEntryLite {
  return {
    employeeId: row.employeeId,
    date,
    statusTypeId: row.statusTypeId,
    departmentId: row.departmentId,
    reason: row.reason,
    note: row.note,
    arrivedAt: row.arrivedAt,
    leftAt: row.leftAt,
    timeReason: row.timeReason,
    extraMinutes: row.extraMinutes,
    extraNote: row.extraNote,
    segments: row.segments.map((s) => ({ ...s })),
  };
}

async function loadContext(tx: Tx, employeeId: string, date: DateStr) {
  const [emp, statusTypes, settings, row] = await Promise.all([
    tx.employee.findUnique({ where: { id: employeeId } }),
    tx.statusType.findMany(),
    getSettings(),
    tx.dayEntry.findUnique({
      where: { employeeId_date: { employeeId, date: toDbDate(date) } },
      include: { segments: SEG_SELECT },
    }),
  ]);
  if (!emp) throw new UserError("Empleado no encontrado.");
  const employee: EmployeeLite = {
    id: emp.id,
    name: emp.name,
    defaultDepartmentId: emp.defaultDepartmentId,
    sortOrder: emp.sortOrder,
    fixedDaysOff: emp.fixedDaysOff,
    active: emp.active,
    notes: emp.notes,
  };
  return {
    employee,
    statusTypes: statusTypes as StatusTypeLite[],
    shift: { shiftStart: settings.shiftStart, shiftEnd: settings.shiftEnd },
    entry: row ? toLite(row, date) : undefined,
    entryId: row?.id ?? null,
  };
}

/** Borra el DayEntry si ya coincide con el patrón. */
async function pruneIfRedundant(tx: Tx, employeeId: string, date: DateStr) {
  const ctx = await loadContext(tx, employeeId, date);
  if (ctx.entry && ctx.entryId && isEntryRedundant(ctx.entry, ctx.employee, date, ctx.statusTypes)) {
    await tx.dayEntry.delete({ where: { id: ctx.entryId } });
  }
}

function revalidateDay() {
  revalidatePath("/hoy", "layout");
  revalidatePath("/semana", "layout");
  revalidatePath("/informe", "layout");
}

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidateDay();
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

const invalid = (): ActionResult => ({ ok: false, error: "Datos no válidos." });

/** Cambios escalares (estado, depto, horario, notas). */
async function mutateScalar(employeeId: string, date: DateStr, patch: EntryPatch): Promise<ActionResult> {
  return run(async () => {
    await db.$transaction(async (tx) => {
      const ctx = await loadContext(tx, employeeId, date);
      if (patch.kind === "status" && !ctx.statusTypes.some((s) => s.id === patch.statusTypeId)) {
        throw new UserError("Estado desconocido.");
      }
      if (patch.kind === "department" && patch.departmentId) {
        const d = await tx.department.findUnique({ where: { id: patch.departmentId } });
        if (!d) throw new UserError("Departamento desconocido.");
      }
      const next = applyEntryPatch(ctx.entry, ctx.employee, date, ctx.statusTypes, patch, ctx.shift.shiftStart);
      const data = {
        statusTypeId: next.statusTypeId,
        departmentId: next.departmentId,
        reason: next.reason,
        note: next.note,
        arrivedAt: next.arrivedAt,
        leftAt: next.leftAt,
        timeReason: next.timeReason,
        extraMinutes: next.extraMinutes ?? null,
        extraNote: next.extraNote ?? null,
      };
      await tx.dayEntry.upsert({
        where: { employeeId_date: { employeeId, date: toDbDate(date) } },
        create: { employeeId, date: toDbDate(date), ...data },
        update: data,
      });
      await pruneIfRedundant(tx, employeeId, date);
    });
  });
}

// ---- Acciones de empleado/día -------------------------------------------

export async function setStatus(input: z.input<typeof setStatusSchema>): Promise<ActionResult> {
  const p = setStatusSchema.safeParse(input);
  if (!p.success) return invalid();
  return mutateScalar(p.data.employeeId, p.data.date, {
    kind: "status",
    statusTypeId: p.data.statusTypeId,
    reason: p.data.reason,
  });
}

export async function setReason(input: z.input<typeof setReasonSchema>): Promise<ActionResult> {
  const p = setReasonSchema.safeParse(input);
  if (!p.success) return invalid();
  return mutateScalar(p.data.employeeId, p.data.date, { kind: "reason", reason: p.data.reason });
}

/** departmentId null = departamento habitual. */
export async function setDepartment(input: z.input<typeof setDepartmentSchema>): Promise<ActionResult> {
  const p = setDepartmentSchema.safeParse(input);
  if (!p.success) return invalid();
  return mutateScalar(p.data.employeeId, p.data.date, { kind: "department", departmentId: p.data.departmentId });
}

export async function setTimes(input: z.input<typeof setTimesSchema>): Promise<ActionResult> {
  const p = setTimesSchema.safeParse(input);
  if (!p.success) return invalid();
  const { employeeId, date, arrivedAt, leftAt, timeReason } = p.data;
  return mutateScalar(employeeId, date, { kind: "times", arrivedAt, leftAt, timeReason });
}

export async function setNote(input: z.input<typeof setNoteSchema>): Promise<ActionResult> {
  const p = setNoteSchema.safeParse(input);
  if (!p.success) return invalid();
  return mutateScalar(p.data.employeeId, p.data.date, { kind: "note", note: p.data.note });
}

/** Aplica horas extra dentro de una transacción (0 = sin horas extra). */
async function applyOvertime(
  tx: Tx,
  date: DateStr,
  item: { employeeId: string; extraMinutes: number; extraNote?: string | null },
) {
  const ctx = await loadContext(tx, item.employeeId, date);
  const next = applyEntryPatch(
    ctx.entry,
    ctx.employee,
    date,
    ctx.statusTypes,
    { kind: "overtime", extraMinutes: item.extraMinutes, extraNote: item.extraNote ?? null },
    ctx.shift.shiftStart,
  );
  await tx.dayEntry.upsert({
    where: { employeeId_date: { employeeId: item.employeeId, date: toDbDate(date) } },
    create: {
      employeeId: item.employeeId,
      date: toDbDate(date),
      statusTypeId: next.statusTypeId,
      extraMinutes: next.extraMinutes ?? null,
      extraNote: next.extraNote ?? null,
    },
    update: { extraMinutes: next.extraMinutes ?? null, extraNote: next.extraNote ?? null },
  });
  await pruneIfRedundant(tx, item.employeeId, date);
}

/** Horas extra de un empleado esa noche. 0 = sin horas extra. */
export async function setOvertime(input: z.input<typeof setOvertimeSchema>): Promise<ActionResult> {
  const p = setOvertimeSchema.safeParse(input);
  if (!p.success) return invalid();
  const { date, ...item } = p.data;
  return run(async () => {
    await db.$transaction((tx) => applyOvertime(tx, date, item));
  });
}

/** Cierre de turno: varias horas extra en una sola transacción. */
export async function setOvertimeBulk(input: z.input<typeof setOvertimeBulkSchema>): Promise<ActionResult> {
  const p = setOvertimeBulkSchema.safeParse(input);
  if (!p.success) return invalid();
  const { date, items } = p.data;
  return run(async () => {
    await db.$transaction(async (tx) => {
      for (const item of items) await applyOvertime(tx, date, item);
    }, { timeout: 20000, maxWait: 10000 });
  });
}

// ---- Tramos --------------------------------------------------------------

type SegData = z.infer<typeof addSegmentSchema>;

function checkSegmentBasics(d: Pick<SegData, "sectionId" | "label">) {
  if (!d.sectionId && !d.label?.trim()) throw new UserError("Elige una sección o escribe la tarea.");
}

/** Crea el entry (con valores efectivos) si no existe y devuelve su id. */
async function ensureEntry(tx: Tx, employeeId: string, date: DateStr): Promise<string> {
  const ctx = await loadContext(tx, employeeId, date);
  if (ctx.entryId) return ctx.entryId;
  const b = baseEntry(ctx.employee, date, ctx.statusTypes);
  const created = await tx.dayEntry.create({
    data: { employeeId, date: toDbDate(date), statusTypeId: b.statusTypeId },
  });
  return created.id;
}

async function resequence(tx: Tx, entryId: string, shiftStart: string) {
  const segs = await tx.workSegment.findMany({ where: { dayEntryId: entryId } });
  const sorted = sortSegments(segs, shiftStart);
  for (const s of sorted) {
    const old = segs.find((x) => x.id === s.id);
    if (old && old.sortOrder !== s.sortOrder) {
      await tx.workSegment.update({ where: { id: s.id }, data: { sortOrder: s.sortOrder } });
    }
  }
}

export async function addSegment(input: z.input<typeof addSegmentSchema>): Promise<ActionResult> {
  const p = addSegmentSchema.safeParse(input);
  if (!p.success) return invalid();
  const d = p.data;
  return run(async () => {
    checkSegmentBasics(d);
    await db.$transaction(async (tx) => {
      const ctx = await loadContext(tx, d.employeeId, d.date);
      const err = validateSegmentSpan(ctx.entry?.segments ?? [], d, ctx.shift);
      if (err) throw new UserError(err);
      const entryId = await ensureEntry(tx, d.employeeId, d.date);
      await tx.workSegment.create({
        data: {
          dayEntryId: entryId,
          sectionId: d.sectionId,
          label: d.sectionId ? null : d.label?.trim() || null,
          start: d.start,
          end: d.end,
        },
      });
      await resequence(tx, entryId, ctx.shift.shiftStart);
      await pruneIfRedundant(tx, d.employeeId, d.date);
    });
  });
}

export async function updateSegment(input: z.input<typeof updateSegmentSchema>): Promise<ActionResult> {
  const p = updateSegmentSchema.safeParse(input);
  if (!p.success) return invalid();
  const d = p.data;
  return run(async () => {
    checkSegmentBasics(d);
    await db.$transaction(async (tx) => {
      const ctx = await loadContext(tx, d.employeeId, d.date);
      if (!ctx.entryId || !ctx.entry?.segments.some((s) => s.id === d.segmentId)) {
        throw new UserError("El tramo ya no existe.");
      }
      const err = validateSegmentSpan(ctx.entry.segments, { id: d.segmentId, start: d.start, end: d.end }, ctx.shift);
      if (err) throw new UserError(err);
      await tx.workSegment.update({
        where: { id: d.segmentId },
        data: {
          sectionId: d.sectionId,
          label: d.sectionId ? null : d.label?.trim() || null,
          start: d.start,
          end: d.end,
        },
      });
      await resequence(tx, ctx.entryId, ctx.shift.shiftStart);
    });
  });
}

export async function deleteSegment(input: z.input<typeof deleteSegmentSchema>): Promise<ActionResult> {
  const p = deleteSegmentSchema.safeParse(input);
  if (!p.success) return invalid();
  const d = p.data;
  return run(async () => {
    await db.$transaction(async (tx) => {
      const ctx = await loadContext(tx, d.employeeId, d.date);
      if (!ctx.entryId) return;
      await tx.workSegment.deleteMany({ where: { id: d.segmentId, dayEntryId: ctx.entryId } });
      await resequence(tx, ctx.entryId, ctx.shift.shiftStart);
      await pruneIfRedundant(tx, d.employeeId, d.date);
    });
  });
}

// ---- Nota del día --------------------------------------------------------

export async function setDayNote(input: z.input<typeof setDayNoteSchema>): Promise<ActionResult> {
  const p = setDayNoteSchema.safeParse(input);
  if (!p.success) return invalid();
  const text = p.data.text.trim();
  return run(async () => {
    const date = toDbDate(p.data.date);
    if (!text) {
      await db.dayNote.deleteMany({ where: { date } });
    } else {
      await db.dayNote.upsert({ where: { date }, create: { date, text }, update: { text } });
    }
  });
}

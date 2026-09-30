"use server";

/** Server Actions de la ficha del empleado: notas, fotos y peticiones. */
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { db } from "@/lib/db";
import { type DateStr, fromDbDate, madridInstant, toDbDate } from "@/lib/dates";
import {
  type CreateNoteInput,
  type CreateRequestInput,
  type UpdateNoteInput,
  type UpdateRequestInput,
  approveRequestSchema,
  createNoteSchema,
  createRequestSchema,
  deleteNotePhotoSchema,
  deleteNoteSchema,
  denyRequestSchema,
  requestIdSchema,
  updateNoteSchema,
  updateRequestSchema,
} from "@/lib/employee-file";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  type CoverageIssue,
  type LeaveChange,
  type LeaveType,
  parseAppliedChanges,
  planLeaveApproval,
  planLeaveImpact,
  planLeaveRevert,
  requestDates,
} from "@/lib/leave";
import { applyDayStatus } from "@/lib/leave-apply";
import { getDepartments, getEmployees, getEntriesBetween, getStatusTypes, toEntryLite } from "@/lib/queries";
import { getEffectiveDay } from "@/lib/schedule";
import { deleteStoredFiles } from "@/lib/storage";

export type FileActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

class UserError extends Error {}
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const zodError = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos.";

function revalidate() {
  revalidatePath("/ajustes", "layout");
  revalidatePath("/semana", "layout");
  revalidatePath("/hoy", "layout");
  revalidatePath("/informe", "layout");
}

const unexpected = (e: unknown) => {
  if (e instanceof UserError) return fail(e.message);
  console.error(e);
  return fail("No se pudo guardar. Inténtalo de nuevo.");
};

/** Borra del almacenamiento fotos subidas de una entrada que finalmente no se guarda. */
async function discardPhotos(input: unknown) {
  const photos = (input as { photos?: { pathname?: unknown }[] } | null)?.photos;
  if (!Array.isArray(photos)) return;
  const names = photos
    .map((x) => x?.pathname)
    .filter((n): n is string => typeof n === "string" && n.startsWith("reports/") && !n.includes(".."));
  if (names.length) await deleteStoredFiles(names);
}

// ---------------------------------------------------------------- Notas

export async function createNote(input: CreateNoteInput): Promise<FileActionResult<{ id: string }>> {
  const p = createNoteSchema.safeParse(input);
  if (!p.success) {
    await discardPhotos(input);
    return fail(zodError(p.error));
  }
  const d = p.data;
  if (!(await db.employee.findUnique({ where: { id: d.employeeId }, select: { id: true } }))) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return fail("El empleado no existe.");
  }
  try {
    const n = await db.employeeNote.create({
      data: {
        employeeId: d.employeeId,
        occurredAt: madridInstant(d.date, d.time),
        category: d.category,
        text: d.text,
        photos: {
          create: d.photos.map((ph, i) => ({
            url: ph.url, pathname: ph.pathname, width: ph.width, height: ph.height, size: ph.size, sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    revalidate();
    return { ok: true, id: n.id };
  } catch (e) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return unexpected(e);
  }
}

/** Edita una nota; `photos` son fotos nuevas que se añaden (máx. 6 en total). */
export async function updateNote(input: UpdateNoteInput): Promise<FileActionResult> {
  const p = updateNoteSchema.safeParse(input);
  if (!p.success) {
    await discardPhotos(input);
    return fail(zodError(p.error));
  }
  const d = p.data;
  const note = await db.employeeNote.findUnique({ where: { id: d.id }, include: { photos: { select: { sortOrder: true } } } });
  if (!note) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return fail("La nota ya no existe.");
  }
  if (note.photos.length + d.photos.length > 6) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return fail("Máximo 6 fotos por nota.");
  }
  const start = note.photos.reduce((m, x) => Math.max(m, x.sortOrder + 1), 0);
  try {
    await db.employeeNote.update({
      where: { id: d.id },
      data: {
        occurredAt: madridInstant(d.date, d.time),
        category: d.category,
        text: d.text,
        photos: {
          create: d.photos.map((ph, i) => ({
            url: ph.url, pathname: ph.pathname, width: ph.width, height: ph.height, size: ph.size, sortOrder: start + i,
          })),
        },
      },
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return unexpected(e);
  }
}

export async function deleteNote(input: z.input<typeof deleteNoteSchema>): Promise<FileActionResult> {
  const p = deleteNoteSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const note = await db.employeeNote.findUnique({ where: { id: p.data.id }, include: { photos: true } });
  if (!note) return fail("La nota ya no existe.");
  await db.employeeNote.delete({ where: { id: note.id } });
  await deleteStoredFiles(note.photos.map((x) => x.pathname));
  revalidate();
  return { ok: true };
}

export async function deleteNotePhoto(input: z.input<typeof deleteNotePhotoSchema>): Promise<FileActionResult> {
  const p = deleteNotePhotoSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const photo = await db.employeeNotePhoto.findUnique({ where: { id: p.data.photoId } });
  if (!photo) return fail("La foto ya no existe.");
  await db.employeeNotePhoto.delete({ where: { id: photo.id } });
  await deleteStoredFiles([photo.pathname]);
  revalidate();
  return { ok: true };
}

// ------------------------------------------------------------ Peticiones

export async function createRequest(input: CreateRequestInput): Promise<FileActionResult<{ id: string }>> {
  const p = createRequestSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const d = p.data;
  if (!(await db.employee.findUnique({ where: { id: d.employeeId }, select: { id: true } }))) {
    return fail("El empleado no existe.");
  }
  try {
    const r = await db.leaveRequest.create({
      data: {
        employeeId: d.employeeId,
        type: d.type,
        dateFrom: toDbDate(d.dateFrom),
        dateTo: toDbDate(d.dateTo),
        note: d.note,
        requestedAt: toDbDate(d.requestedAt),
      },
      select: { id: true },
    });
    revalidate();
    return { ok: true, id: r.id };
  } catch (e) {
    return unexpected(e);
  }
}

export async function updateRequest(input: UpdateRequestInput): Promise<FileActionResult> {
  const p = updateRequestSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const d = p.data;
  try {
    const res = await db.leaveRequest.updateMany({
      where: { id: d.id, status: "PENDING" },
      data: {
        type: d.type,
        dateFrom: toDbDate(d.dateFrom),
        dateTo: toDbDate(d.dateTo),
        note: d.note,
        requestedAt: toDbDate(d.requestedAt),
      },
    });
    if (res.count === 0) return fail("Solo se pueden editar peticiones pendientes.");
    revalidate();
    return { ok: true };
  } catch (e) {
    return unexpected(e);
  }
}

export async function deleteRequest(input: z.input<typeof requestIdSchema>): Promise<FileActionResult> {
  const p = requestIdSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const res = await db.leaveRequest.deleteMany({ where: { id: p.data.id, status: "PENDING" } });
  if (res.count === 0) return fail("Solo se pueden borrar peticiones pendientes.");
  revalidate();
  return { ok: true };
}

export async function denyRequest(input: z.input<typeof denyRequestSchema>): Promise<FileActionResult> {
  const p = denyRequestSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const res = await db.leaveRequest.updateMany({
    where: { id: p.data.id, status: "PENDING" },
    data: { status: "DENIED", decisionNote: p.data.decisionNote, decidedAt: new Date() },
  });
  if (res.count === 0) return fail("La petición ya no está pendiente.");
  revalidate();
  return { ok: true };
}

// ----------------------------------------------- Aprobar / revertir

export interface ApprovalPreview {
  changes: { date: DateStr; fromLabel: string; toLabel: string }[];
  conflicts: { date: DateStr; statusLabel: string }[];
  issues: CoverageIssue[];
  /** Petición sin efecto en el calendario (tipo Otro o todo ya estaba así). */
  noCalendarChanges: boolean;
}

async function loadRequest(id: string) {
  const r = await db.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!r) throw new UserError("La petición ya no existe.");
  return {
    ...r,
    lite: { type: r.type as LeaveType, dateFrom: fromDbDate(r.dateFrom), dateTo: fromDbDate(r.dateTo) },
  };
}

/** Qué cambiaría aprobar la petición (sin escribir nada): para la confirmación. */
export async function previewApproval(input: z.input<typeof approveRequestSchema>): Promise<FileActionResult<{ preview: ApprovalPreview }>> {
  const p = approveRequestSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  try {
    const r = await loadRequest(p.data.id);
    if (r.status !== "PENDING") throw new UserError("La petición ya no está pendiente.");
    const dates = requestDates(r.lite).sort();
    const from = dates[0] ?? r.lite.dateFrom;
    const to = dates[dates.length - 1] ?? r.lite.dateTo;
    const [employees, departments, statusTypes, entries] = await Promise.all([
      getEmployees(),
      getDepartments(),
      getStatusTypes(),
      getEntriesBetween(from, to),
    ]);
    const employee = employees.find((e) => e.id === r.employeeId);
    if (!employee) throw new UserError("Empleado no encontrado.");
    const plan = planLeaveApproval(r.lite, employee, entries, statusTypes);
    if (plan.error) throw new UserError(plan.error);
    const label = (id: string) => statusTypes.find((s) => s.id === id)?.label ?? "—";
    const issues = planLeaveImpact({ changes: plan.changes, employee, employees, entries, departments, statusTypes });
    return {
      ok: true,
      preview: {
        changes: plan.changes.map((c) => ({ date: c.date, fromLabel: label(c.fromStatusId), toLabel: label(c.toStatusId) })),
        conflicts: plan.conflicts.map((c) => ({ date: c.date, statusLabel: label(c.statusId) })),
        issues,
        noCalendarChanges: plan.changes.length === 0,
      },
    };
  } catch (e) {
    return unexpected(e);
  }
}

/** Aprueba: aplica los cambios al calendario y guarda qué se cambió, todo en una transacción. */
export async function approveRequest(input: z.input<typeof approveRequestSchema>): Promise<FileActionResult<{ changed: number }>> {
  const p = approveRequestSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  try {
    const changed = await db.$transaction(async (tx) => {
      const r = await tx.leaveRequest.findUnique({ where: { id: p.data.id }, include: { employee: true } });
      if (!r) throw new UserError("La petición ya no existe.");
      if (r.status !== "PENDING") throw new UserError("La petición ya no está pendiente.");
      const lite = { type: r.type as LeaveType, dateFrom: fromDbDate(r.dateFrom), dateTo: fromDbDate(r.dateTo) };
      const dates = requestDates(lite);
      const [statusTypes, rows] = await Promise.all([
        tx.statusType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
        tx.dayEntry.findMany({
          where: { employeeId: r.employeeId, date: { in: dates.map(toDbDate) } },
          include: { segments: { orderBy: { sortOrder: "asc" } } },
        }),
      ]);
      const entries = rows.map(toEntryLite);
      const plan = planLeaveApproval(lite, r.employee, entries, statusTypes);
      if (plan.error) throw new UserError(plan.error);
      for (const c of plan.changes) {
        await applyDayStatus(tx, {
          employee: r.employee,
          date: c.date,
          statusTypeId: c.toStatusId,
          reason: null,
          existing: entries.find((e) => e.date === c.date) ?? null,
          statusTypes,
        });
      }
      const res = await tx.leaveRequest.updateMany({
        where: { id: r.id, status: "PENDING" },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
          decisionNote: null,
          appliedChanges: plan.changes as unknown as Prisma.InputJsonValue,
        },
      });
      if (res.count === 0) throw new UserError("La petición ya no está pendiente.");
      return plan.changes.length;
    });
    revalidate();
    return { ok: true, changed };
  } catch (e) {
    return unexpected(e);
  }
}

/** Revierte una aprobada: restaura los estados previos y la deja como pendiente. */
export async function revertRequest(input: z.input<typeof requestIdSchema>): Promise<FileActionResult<{ restored: number }>> {
  const p = requestIdSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  try {
    const restored = await db.$transaction(async (tx) => {
      const r = await tx.leaveRequest.findUnique({ where: { id: p.data.id }, include: { employee: true } });
      if (!r) throw new UserError("La petición ya no existe.");
      if (r.status !== "APPROVED") throw new UserError("Solo se pueden revertir peticiones aprobadas.");
      const applied: LeaveChange[] = parseAppliedChanges(r.appliedChanges);
      const statusTypes = await tx.statusType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
      const rows = await tx.dayEntry.findMany({
        where: { employeeId: r.employeeId, date: { in: applied.map((c) => toDbDate(c.date)) } },
        include: { segments: { orderBy: { sortOrder: "asc" } } },
      });
      const entries = rows.map(toEntryLite);
      const current = new Map<DateStr, string>(
        applied.map((c) => [
          c.date,
          getEffectiveDay(r.employee, c.date, entries.find((e) => e.date === c.date) ?? null, statusTypes).status.id,
        ]),
      );
      const writes = planLeaveRevert(applied, current);
      for (const w of writes) {
        await applyDayStatus(tx, {
          employee: r.employee,
          date: w.date,
          statusTypeId: w.statusTypeId,
          reason: w.reason,
          existing: entries.find((e) => e.date === w.date) ?? null,
          statusTypes,
        });
      }
      await tx.leaveRequest.update({
        where: { id: r.id },
        data: { status: "PENDING", decidedAt: null, decisionNote: null, appliedChanges: Prisma.DbNull },
      });
      return writes.length;
    });
    revalidate();
    return { ok: true, restored };
  } catch (e) {
    return unexpected(e);
  }
}

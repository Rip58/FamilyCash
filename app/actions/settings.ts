"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { REF_TAG } from "@/lib/queries";
import { checkPassword } from "@/lib/password";
import { isHexColor, isTime, isProtectedStatus, nextSortOrder, sortOrderUpdates, uniqueCode } from "@/lib/settings-logic";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function done<T extends object>(extra?: T): { ok: true } & T {
  updateTag(REF_TAG);
  revalidatePath("/", "layout");
  return { ok: true, ...(extra ?? ({} as T)) };
}

function zodError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Datos no válidos.";
}

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Escribe un nombre.").max(80, "Nombre demasiado largo.");
const color = z.string().refine(isHexColor, "Color no válido.");
const optionalId = z.string().max(64).nullish().transform((v) => (v ? v : null));
const idList = z.array(id).max(500);

// ---------------------------------------------------------------- Empleados

const employeeSchema = z.object({
  id: id.optional(),
  name,
  alias: z.string().trim().max(12, "El alias puede tener como máximo 12 caracteres.").nullish().transform((v) => v || null),
  defaultDepartmentId: optionalId,
  fixedDaysOff: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .transform((a) => [...new Set(a)].sort((x, y) => x - y)),
  notes: z.string().trim().max(500).nullish().transform((v) => v || null),
  active: z.boolean(),
});

async function endOfDepartment(departmentId: string | null): Promise<number> {
  const rows = await db.employee.findMany({
    where: { defaultDepartmentId: departmentId },
    select: { sortOrder: true },
  });
  return nextSortOrder(rows.map((r) => r.sortOrder));
}

export async function saveEmployee(input: z.input<typeof employeeSchema>): Promise<ActionResult<{ id: string }>> {
  const p = employeeSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id: empId, ...data } = p.data;
  if (data.defaultDepartmentId) {
    const dep = await db.department.findUnique({ where: { id: data.defaultDepartmentId } });
    if (!dep) return fail("El departamento no existe.");
  }
  if (!empId) {
    const created = await db.employee.create({
      data: { ...data, sortOrder: await endOfDepartment(data.defaultDepartmentId) },
    });
    return done({ id: created.id });
  }
  const current = await db.employee.findUnique({ where: { id: empId } });
  if (!current) return fail("El empleado ya no existe.");
  const moved = current.defaultDepartmentId !== data.defaultDepartmentId;
  await db.employee.update({
    where: { id: empId },
    data: { ...data, ...(moved ? { sortOrder: await endOfDepartment(data.defaultDepartmentId) } : {}) },
  });
  return done({ id: empId });
}

export async function deleteEmployee(rawId: string): Promise<ActionResult> {
  const p = id.safeParse(rawId);
  if (!p.success) return fail("Empleado no válido.");
  const [entries, notes, requests] = await Promise.all([
    db.dayEntry.count({ where: { employeeId: p.data } }),
    db.employeeNote.count({ where: { employeeId: p.data } }),
    db.leaveRequest.count({ where: { employeeId: p.data } }),
  ]);
  if (entries + notes + requests > 0) return fail("Tiene historial: no se puede borrar. Márcalo como inactivo.");
  await db.employee.deleteMany({ where: { id: p.data } });
  return done();
}

/** Reordena los empleados de un departamento (ids en el orden nuevo). */
export async function reorderEmployees(ids: string[]): Promise<ActionResult> {
  const p = idList.safeParse(ids);
  if (!p.success) return fail("Datos no válidos.");
  await db.$transaction(
    sortOrderUpdates(p.data).map((u) => db.employee.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
  );
  return done();
}

/** Mueve un empleado a otro departamento (al final de la lista). */
export async function moveEmployee(input: { id: string; departmentId: string | null }): Promise<ActionResult> {
  const p = z.object({ id, departmentId: optionalId }).safeParse(input);
  if (!p.success) return fail("Datos no válidos.");
  await db.employee.update({
    where: { id: p.data.id },
    data: { defaultDepartmentId: p.data.departmentId, sortOrder: await endOfDepartment(p.data.departmentId) },
  });
  return done();
}

// ------------------------------------------------------------ Departamentos

const departmentSchema = z.object({
  id: id.optional(),
  name,
  color,
  targetStaff: z.number().int().min(0).max(99),
  active: z.boolean(),
});

export async function saveDepartment(input: z.input<typeof departmentSchema>): Promise<ActionResult<{ id: string }>> {
  const p = departmentSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id: depId, ...data } = p.data;
  if (!depId) {
    const rows = await db.department.findMany({ select: { sortOrder: true } });
    const created = await db.department.create({
      data: { ...data, sortOrder: nextSortOrder(rows.map((r) => r.sortOrder)) },
    });
    return done({ id: created.id });
  }
  await db.department.update({ where: { id: depId }, data });
  return done({ id: depId });
}

export async function reorderDepartments(ids: string[]): Promise<ActionResult> {
  const p = idList.safeParse(ids);
  if (!p.success) return fail("Datos no válidos.");
  await db.$transaction(
    sortOrderUpdates(p.data).map((u) => db.department.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
  );
  return done();
}

/** Borra un departamento solo si está vacío de empleados y secciones. */
export async function deleteDepartment(rawId: string): Promise<ActionResult> {
  const p = id.safeParse(rawId);
  if (!p.success) return fail("Departamento no válido.");
  const [emps, secs] = await Promise.all([
    db.employee.count({ where: { defaultDepartmentId: p.data } }),
    db.section.count({ where: { departmentId: p.data } }),
  ]);
  if (emps + secs > 0) return fail("Tiene empleados o secciones. Muévelos o desactívalo.");
  await db.department.deleteMany({ where: { id: p.data } });
  return done();
}

// ---------------------------------------------------------------- Secciones

const sectionSchema = z.object({
  id: id.optional(),
  name,
  departmentId: optionalId,
  active: z.boolean(),
});

export async function saveSection(input: z.input<typeof sectionSchema>): Promise<ActionResult<{ id: string }>> {
  const p = sectionSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id: secId, ...data } = p.data;
  if (!secId) {
    const rows = await db.section.findMany({ select: { sortOrder: true } });
    const created = await db.section.create({
      data: { ...data, sortOrder: nextSortOrder(rows.map((r) => r.sortOrder)) },
    });
    return done({ id: created.id });
  }
  await db.section.update({ where: { id: secId }, data });
  return done({ id: secId });
}

export async function reorderSections(ids: string[]): Promise<ActionResult> {
  const p = idList.safeParse(ids);
  if (!p.success) return fail("Datos no válidos.");
  await db.$transaction(
    sortOrderUpdates(p.data).map((u) => db.section.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
  );
  return done();
}

export async function deleteSection(rawId: string): Promise<ActionResult> {
  const p = id.safeParse(rawId);
  if (!p.success) return fail("Sección no válida.");
  const used = await db.workSegment.count({ where: { sectionId: p.data } });
  if (used > 0) return fail("Se ha usado en tramos: no se puede borrar. Desactívala.");
  await db.section.deleteMany({ where: { id: p.data } });
  return done();
}

// ------------------------------------------------------------------- Estados

const statusSchema = z.object({
  id: id.optional(),
  label: z.string().trim().min(1, "Escribe una etiqueta.").max(40, "Etiqueta demasiado larga."),
  color,
  isWorking: z.boolean(),
  active: z.boolean(),
});

export async function saveStatus(input: z.input<typeof statusSchema>): Promise<ActionResult<{ id: string }>> {
  const p = statusSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id: stId, ...data } = p.data;
  if (!stId) {
    const all = await db.statusType.findMany({ select: { code: true, sortOrder: true } });
    const created = await db.statusType.create({
      data: {
        ...data,
        code: uniqueCode(data.label, all.map((s) => s.code)),
        sortOrder: nextSortOrder(all.map((s) => s.sortOrder)),
      },
    });
    return done({ id: created.id });
  }
  const current = await db.statusType.findUnique({ where: { id: stId } });
  if (!current) return fail("El estado ya no existe.");
  if (isProtectedStatus(current.code)) {
    // WORK y OFF: siempre activos y con su semántica; solo etiqueta y color.
    await db.statusType.update({ where: { id: stId }, data: { label: data.label, color: data.color } });
  } else {
    await db.statusType.update({ where: { id: stId }, data });
  }
  return done({ id: stId });
}

export async function reorderStatuses(ids: string[]): Promise<ActionResult> {
  const p = idList.safeParse(ids);
  if (!p.success) return fail("Datos no válidos.");
  await db.$transaction(
    sortOrderUpdates(p.data).map((u) => db.statusType.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
  );
  return done();
}

/** Borra un estado (nunca WORK/OFF) solo si ningún día lo usa. */
export async function deleteStatus(rawId: string): Promise<ActionResult> {
  const p = id.safeParse(rawId);
  if (!p.success) return fail("Estado no válido.");
  const st = await db.statusType.findUnique({ where: { id: p.data } });
  if (!st) return done();
  if (isProtectedStatus(st.code)) return fail("Este estado no se puede borrar.");
  const used = await db.dayEntry.count({ where: { OR: [{ statusTypeId: st.id }, { actualStatusTypeId: st.id }] } });
  if (used > 0) return fail("Hay días con este estado: no se puede borrar. Desactívalo.");
  await db.statusType.delete({ where: { id: st.id } });
  return done();
}

// --------------------------------------------------------------------- Turno

const time = z.string().refine(isTime, "Hora no válida.");
const shiftSchema = z.object({
  shiftStart: time,
  shiftEnd: time,
  breakStart: time,
  breakEnd: time,
  dayRolloverHour: z.number().int().min(0).max(23),
  daysOffPerWeek: z.number().int().min(0).max(7),
});

export async function saveShift(input: z.input<typeof shiftSchema>): Promise<ActionResult> {
  const p = shiftSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  await db.settings.upsert({ where: { id: 1 }, update: p.data, create: { id: 1, ...p.data } });
  return done();
}

// ----------------------------------------------------------------- Seguridad

const passwordSchema = z
  .object({
    current: z.string().min(1, "Escribe la contraseña actual.").max(200),
    next: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres.").max(200),
    repeat: z.string().max(200),
  })
  .refine((v) => v.next === v.repeat, { message: "Las contraseñas nuevas no coinciden.", path: ["repeat"] });

export async function changePassword(input: z.input<typeof passwordSchema>): Promise<ActionResult> {
  const p = passwordSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  if (!(await checkPassword(p.data.current))) return fail("La contraseña actual no es correcta.");
  const passwordHash = await bcrypt.hash(p.data.next, 10);
  await db.settings.upsert({ where: { id: 1 }, update: { passwordHash }, create: { id: 1, passwordHash } });
  return done();
}

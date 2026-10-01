"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, isMonthStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";

export type PayrollActionResult = { ok: true } | { ok: false; error: string };

const cents = z.number().int().min(0).max(100_000_000);
const percent = z.number().min(0).max(100);

const settingsSchema = z.object({
  employeeId: z.string().max(64).nullable(),
  baseMonthlyCents: cents,
  respPlusCents: cents,
  proratedExtraCents: cents,
  nightPlusMode: z.enum(["PER_NIGHT", "PERCENT"]),
  nightPlusPerNightCents: cents,
  nightPlusPercent: percent,
  overtimeMode: z.enum(["LAW", "FIXED"]),
  overtimeSurchargePercent: percent,
  overtimeHourCents: cents,
  holidayWorkedCents: cents,
  ssPercent: percent,
  irpfPercent: percent,
});

const count = z.number().int().min(0).max(31).nullable();
const payslipSchema = z.object({
  month: z.string().refine(isMonthStr, "Mes no válido."),
  contractDays: count,
  daysOff: count,
  vacationDays: count,
  sickDays: count,
  absentDays: count,
  holidaysWorked: count,
  extraMinutes: z.number().int().min(0).max(744 * 60).nullable(),
  grossCents: cents.nullable(),
  netCents: cents.nullable(),
  note: z.string().trim().max(500).nullable().transform((v) => v || null),
});

const dateStr = z.string().refine(isDateStr, "Fecha no válida.");
const periodSchema = z
  .object({
    id: z.string().max(64).optional(),
    from: dateStr,
    to: dateStr.nullable(),
    baseCents: cents,
    respPlusCents: cents,
  })
  .refine((p) => p.to === null || p.to >= p.from, "La fecha final es anterior a la inicial.");

function revalidate() {
  revalidatePath("/nomina", "layout");
  revalidatePath("/ajustes/nomina");
}

export async function savePayrollSettings(input: z.input<typeof settingsSchema>): Promise<PayrollActionResult> {
  const p = settingsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  if (p.data.employeeId && !(await db.employee.findUnique({ where: { id: p.data.employeeId } }))) {
    return { ok: false, error: "Empleado no encontrado." };
  }
  await db.payrollSettings.upsert({ where: { id: 1 }, create: { id: 1, ...p.data }, update: p.data });
  revalidate();
  return { ok: true };
}

/** Guarda el registro del mes; si todo queda vacío (automático), lo borra. */
export async function savePayslip(input: z.input<typeof payslipSchema>): Promise<PayrollActionResult> {
  const p = payslipSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  const { month, ...data } = p.data;
  if (Object.values(data).every((v) => v === null)) {
    await db.payslip.deleteMany({ where: { month } });
  } else {
    await db.payslip.upsert({ where: { month }, create: { month, ...data }, update: data });
  }
  revalidate();
  return { ok: true };
}

export async function savePayrollPeriod(input: z.input<typeof periodSchema>): Promise<PayrollActionResult> {
  const p = periodSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  const { id, from, to, ...money } = p.data;
  const data = { from: toDbDate(from), to: to ? toDbDate(to) : null, ...money };
  if (id) await db.payrollPeriod.update({ where: { id }, data });
  else await db.payrollPeriod.create({ data });
  revalidate();
  return { ok: true };
}

export async function deletePayrollPeriod(id: string): Promise<PayrollActionResult> {
  const p = z.string().min(1).max(64).safeParse(id);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.payrollPeriod.deleteMany({ where: { id: p.data } });
  revalidate();
  return { ok: true };
}

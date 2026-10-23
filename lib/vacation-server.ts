/**
 * Página de vacaciones de los empleados (/vacaciones): quién es por su PIN (cookie `vac`) y permisos de sus acciones.
 * Cada empleado solo ve y toca SUS vacaciones del año de la campaña.
 */
import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { Unauthorized } from "./session";
import { VACATION_PIN_RE } from "./vacations";

export const VACATION_COOKIE = "vac";

/** El empleado de la cookie (si su PIN sigue existiendo y está activo). */
export async function currentVacationEmployee(): Promise<{ id: string; name: string } | null> {
  const pin = (await cookies()).get(VACATION_COOKIE)?.value;
  if (!pin || !VACATION_PIN_RE.test(pin)) return null;
  const row = await db.vacationPin.findUnique({ where: { pin }, select: { employee: { select: { id: true, name: true, active: true } } } });
  return row?.employee.active ? { id: row.employee.id, name: row.employee.name } : null;
}

/** Acciones de /vacaciones: devuelve el empleado o lanza si no ha entrado con su PIN. */
export async function authorizeVacation(): Promise<{ id: string; name: string }> {
  const e = await currentVacationEmployee();
  if (!e) throw new Unauthorized();
  return e;
}

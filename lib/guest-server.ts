/**
 * Acceso del compañero en el servidor: cookie `guest` (la pone `enterGuestPin` al acertar el PIN en /turno) y permisos
 * de las acciones de Hoy. El dueño (con sesión) puede todo; el compañero solo la noche en curso (`guestNight`, hasta las
 * 09:30) y mientras el acceso siga activo con el mismo PIN (cambiarlo o apagarlo en Ajustes lo invalida al momento).
 */
import "server-only";
import { cookies } from "next/headers";
import { type DateStr, toDbDate } from "./dates";
import { db } from "./db";
import { guestNight, sameToken } from "./guest";
import { Unauthorized, isOwner } from "./session";

export const GUEST_COOKIE = "guest";

/** Código del enlace activo (sin caché: cambiarlo o apagarlo surte efecto al momento). null = apagado. */
export async function currentGuestToken(): Promise<string | null> {
  return (await db.settings.findUnique({ where: { id: 1 }, select: { guestToken: true } }))?.guestToken ?? null;
}

/** La noche que puede tocar el compañero ahora mismo, o null si no tiene un enlace válido. */
export async function guestNightNow(): Promise<DateStr | null> {
  const jar = await cookies();
  const token = jar.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  return sameToken(token, await currentGuestToken()) ? guestNight(new Date()) : null;
}

/** Acciones de Hoy: el dueño siempre; el compañero solo si `date` es la noche en curso. Lanza si no. */
export async function authorizeNight(date: DateStr): Promise<"owner" | "guest"> {
  if (await isOwner()) return "owner";
  const night = await guestNightNow();
  if (night && night === date) return "guest";
  throw new Unauthorized();
}

/** Algo que no depende de la noche (descartar fotos subidas): dueño o compañero con enlace válido. */
export async function authorizeOwnerOrGuest(): Promise<"owner" | "guest"> {
  if (await isOwner()) return "owner";
  if (await guestNightNow()) return "guest";
  throw new Unauthorized();
}

/** Apunta lo que ha hecho el compañero (sale en tu Hoy de esa noche). */
export async function logGuest(date: DateStr, text: string): Promise<void> {
  try {
    await db.guestChange.create({ data: { date: toDbDate(date), text: text.slice(0, 300) } });
  } catch (e) {
    console.error("No se pudo apuntar el cambio del compañero", e);
  }
}

export async function employeeName(id: string): Promise<string> {
  return (await db.employee.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Alguien";
}

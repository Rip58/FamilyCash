/**
 * Enlace del compañero (sin contraseña): solo la noche en curso, editable hasta las 09:30 de la mañana siguiente.
 * Puro (sin BD ni cookies): se usa en el servidor y en los tests.
 */
import { type DateStr, addDays, madridParts } from "./dates";

/** Hasta qué hora de la mañana siguiente se puede tocar la noche. */
export const GUEST_UNTIL = "09:30";
const UNTIL_MINUTES = 9 * 60 + 30;

/** La noche que puede ver/editar el compañero ahora: antes de las 09:30 todavía es la de ayer. */
export function guestNight(now: Date): DateStr {
  const { date, hour, minute } = madridParts(now);
  return hour * 60 + minute < UNTIL_MINUTES ? addDays(date, -1) : date;
}

/** Segundos que quedan hasta las 09:30 (cuando caduca la cookie del enlace). */
export function secondsUntilGuestEnd(now: Date): number {
  const { hour, minute } = madridParts(now);
  const t = hour * 60 + minute;
  const left = t < UNTIL_MINUTES ? UNTIL_MINUTES - t : 24 * 60 - t + UNTIL_MINUTES;
  return left * 60;
}

/** Comparación en tiempo constante (no da pistas del código por lo que tarda). */
export function sameToken(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Formato del código del enlace (base64url, 32 caracteres). */
export const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

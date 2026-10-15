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

// ---- PIN del compañero ------------------------------------------------------

/** PIN de 4 dígitos. */
export const GUEST_PIN_RE = /^\d{4}$/;
/** Cada 5 fallos seguidos, bloqueo de 15 min; a los 20, el acceso se apaga hasta poner un PIN nuevo. */
export const GUEST_LOCK_EVERY = 5;
export const GUEST_LOCK_MINUTES = 15;
export const GUEST_MAX_FAILS = 20;

/** Qué pasa tras un PIN incorrecto (con `fails` = fallos seguidos que había). */
export function afterWrongPin(fails: number, now: Date): { fails: number; lockedUntil: Date | null; disable: boolean } {
  const next = fails + 1;
  if (next >= GUEST_MAX_FAILS) return { fails: next, lockedUntil: null, disable: true };
  const lock = next % GUEST_LOCK_EVERY === 0 ? new Date(now.getTime() + GUEST_LOCK_MINUTES * 60_000) : null;
  return { fails: next, lockedUntil: lock, disable: false };
}

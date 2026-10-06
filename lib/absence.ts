// Faltas: regla pura (sin BD). Una falta = tocaba trabajar y no vino (lo validado en Hoy no es trabajo y el
// planning sí), o «Falta» (ABSENT) en el planning. Se calcula sobre el día de `getEffectiveDay`.
import type { EffectiveDay } from "./schedule";

export function isMissedDay(day: Pick<EffectiveDay, "isWorking" | "planned" | "status">): boolean {
  return !day.isWorking && (day.planned?.isWorking === true || day.status.code === "ABSENT");
}

export type AbsenceResolution = "SWAP" | "OFF" | "CHANGED";

/** "Avisó" / "No avisó" / "Sin indicar si avisó". */
export function notifiedLabel(notified: boolean | null | undefined): string {
  return notified === true ? "Avisó" : notified === false ? "No avisó" : "Sin indicar si avisó";
}

/** Qué hacer con el registro de faltas tras un cambio del día. */
export function absenceSyncAction(input: {
  before: Pick<EffectiveDay, "isWorking" | "planned" | "status">;
  after: Pick<EffectiveDay, "isWorking" | "planned" | "status">;
  /** "hoy": corregir lo validado (si «ha venido», la falta era un error y se borra); "semana": cambio del planning. */
  source: "hoy" | "semana";
}): "upsert" | "delete-unresolved" | "resolve" | "none" {
  const was = isMissedDay(input.before);
  const is = isMissedDay(input.after);
  if (is) return "upsert";
  if (!was) return "none";
  return input.source === "hoy" ? "delete-unresolved" : "resolve";
}

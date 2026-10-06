// Apuntes de una noche concreta (DayEntry) para el historial del empleado. Puro (tests); solo servidor.
import type { HistoryItem } from "./employee-history";
import { KIND_META } from "./employee-history";
import { formatOvertime } from "./overtime";
import { type ShiftConfig, leaveDelta, lateMinutes } from "./report";
import type { EffectiveDay } from "./schedule";
import { notifiedLabel } from "./absence";
import type { DateStr } from "./dates";

/**
 * `day` es el día efectivo (`getEffectiveDay`). Falta = el planning decía que trabajaba y no vino, o «Falta» (ABSENT);
 * vacaciones, bajas y permisos salen como ausencia si tienen motivo o no son fiesta normal. La fiesta no se apunta.
 */
export function entryHistoryItems(day: EffectiveDay, shift: ShiftConfig): HistoryItem[] {
  const out: HistoryItem[] = [];
  const add = (kind: HistoryItem["kind"], label: string, text: string, color = KIND_META[kind].color) =>
    out.push({ date: day.date, kind, label, text, color });

  if (!day.isWorking) {
    const noShow = day.planned?.isWorking === true || day.status.code === "ABSENT";
    if (noShow) add("absence", "Falta", `No vino (${day.status.label})${day.reason ? ` — ${day.reason}` : ""}`, "#dc2626");
    else if (!day.isDayOff) add("absence", day.status.label, day.reason ?? "Ausencia", day.status.color);
    else if (day.reason) add("absence", day.status.label, day.reason, day.status.color);
  }
  if (day.isWorking && day.arrivedAt) {
    const m = lateMinutes(day.arrivedAt, shift);
    if (m > 0) add("time", "Llega tarde", `a las ${day.arrivedAt} (+${formatOvertime(m)})${day.timeReason ? ` — ${day.timeReason}` : ""}`);
  }
  if (day.isWorking && day.leftAt) {
    const d = leaveDelta(day.leftAt, shift);
    if (d !== 0) {
      const what = d > 0 ? `se queda ${formatOvertime(d)} más` : `se va ${formatOvertime(-d)} antes`;
      add("time", d > 0 ? "Se queda más" : "Se va antes", `${what} (sale a las ${day.leftAt})${day.timeReason ? ` — ${day.timeReason}` : ""}`);
    }
  }
  if (day.isWorking && ((day.extraMinutes ?? 0) > 0 || day.extraNote)) {
    const t = (day.extraMinutes ?? 0) > 0 ? formatOvertime(day.extraMinutes!, true) : "sin tiempo";
    add("overtime", "Horas extra", `${t}${day.extraNote ? ` — ${day.extraNote}` : ""}`);
  }
  if (day.note?.trim()) add("day-note", "Nota del día", day.note.trim());
  return out;
}

/** Una falta del registro (`Absence`): queda aunque luego se cambiara el día a fiesta. */
export function absenceHistoryItem(a: {
  date: DateStr;
  statusLabel: string;
  reason: string | null;
  notified: boolean | null;
  resolutionNote: string | null;
}): HistoryItem {
  const parts = [
    `No vino (${a.statusLabel})${a.reason ? ` — ${a.reason}` : ""}`,
    notifiedLabel(a.notified),
    ...(a.resolutionNote ? [`después: ${a.resolutionNote}`] : []),
  ];
  return { date: a.date, kind: "absence", label: a.notified === false ? "Falta sin avisar" : "Falta", text: parts.join(" · "), color: "#dc2626" };
}

/** Junta las faltas del registro con las de las noches: la del registro manda (tiene el aviso y cómo se resolvió). */
export function mergeAbsenceItems(dayItems: HistoryItem[], logged: HistoryItem[]): HistoryItem[] {
  const dates = new Set(logged.map((i) => i.date));
  return [...dayItems.filter((i) => !(i.kind === "absence" && i.label === "Falta" && dates.has(i.date))), ...logged];
}

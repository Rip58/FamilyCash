// Historial de un empleado (Informe → buscar empleado): todo lo apuntado o hablado con él, agrupado por noche.
// Puro y sin zod (se usa también en el cliente para exportar).
import { type DateStr, formatDayLong } from "./dates";
import { NOTE_TYPE_META, type NoteType, type NoteView, noteLabel } from "./notes";

export type HistoryKind =
  | "note" // nota
  | "task" // tarea
  | "incident" // incidencia
  | "praise" // felicitación
  | "talk" // conversación
  | "request" // petición (fiesta, vacaciones…): una nota más, sin seguimiento
  | "absence" // faltó (tocaba trabajar y no vino, o «Falta»)
  | "leave" // vacaciones, baja, permiso (ausencias previstas)
  | "time" // llegó tarde / se fue antes / se quedó más
  | "overtime"; // horas extra

export interface HistoryItem {
  date: DateStr;
  /** "22:15" si se sabe la hora (notas de ficha). */
  time?: string | null;
  kind: HistoryKind;
  /** Etiqueta corta: "Nota", "Incidencia", "Falta", "Llega tarde"… */
  label: string;
  text: string;
  /** Color de la etiqueta (hex). */
  color: string;
  photos?: number;
  /** Si es una nota: la nota entera (para verla con fotos y editarla). */
  note?: NoteView;
  /** Quién (en los listados de varias personas: «Todas las notas», departamento…). */
  who?: string | null;
}

export interface HistoryDay {
  date: DateStr;
  title: string;
  items: HistoryItem[];
}

export const KIND_META: Record<HistoryKind, { label: string; color: string }> = {
  note: { label: "Notas", color: NOTE_TYPE_META.NOTE.color },
  task: { label: "Tareas", color: NOTE_TYPE_META.TASK.color },
  incident: { label: "Incidencias", color: NOTE_TYPE_META.INCIDENT.color },
  praise: { label: "Felicitaciones", color: NOTE_TYPE_META.PRAISE.color },
  talk: { label: "Conversaciones", color: NOTE_TYPE_META.TALK.color },
  request: { label: "Peticiones", color: NOTE_TYPE_META.REQUEST.color },
  absence: { label: "Faltas", color: "#dc2626" },
  leave: { label: "Vacaciones y bajas", color: "#3b82f6" },
  time: { label: "Horario", color: "#d97706" },
  overtime: { label: "Horas extra", color: "#0a84ff" },
};

/** Orden dentro de una noche: primero lo hablado (notas), luego lo que pasó. */
const ORDER: HistoryKind[] = ["talk", "incident", "praise", "request", "note", "task", "absence", "leave", "time", "overtime"];

const NOTE_KIND: Record<NoteType, HistoryKind> = {
  NOTE: "note",
  TASK: "task",
  INCIDENT: "incident",
  PRAISE: "praise",
  TALK: "talk",
  REQUEST: "request",
};

/** Una nota como apunte del historial. `who` = quién/dónde (en los listados de varias personas). */
export function noteHistoryItem(n: NoteView, who?: string | null): HistoryItem {
  const where = n.sectionName ? ` [${n.sectionName}]` : "";
  return {
    date: n.date,
    time: n.time,
    kind: NOTE_KIND[n.type],
    label: noteLabel(n),
    text: `${n.text}${where}`,
    color: NOTE_TYPE_META[n.type].color,
    photos: n.photos.length || undefined,
    note: n,
    who: who ?? null,
  };
}

/** "Lunes 28 sep" (+ año si no es el actual). */
export function historyDayTitle(date: DateStr, currentYear: number): string {
  const y = Number(date.slice(0, 4));
  return y === currentYear ? formatDayLong(date) : `${formatDayLong(date)} ${y}`;
}

/**
 * Agrupa por noche, de la más reciente a la más antigua. `query` filtra por texto (sin acentos ni mayúsculas) y
 * `kinds` por tipo (vacío = todos).
 */
export function groupHistory(items: HistoryItem[], currentYear: number, query = "", kinds: HistoryKind[] = []): HistoryDay[] {
  const q = normalize(query.trim());
  const byDate = new Map<DateStr, HistoryItem[]>();
  for (const it of items) {
    if (kinds.length > 0 && !kinds.includes(it.kind)) continue;
    if (q && !normalize(`${it.who ?? ""} ${it.label} ${it.text}`).includes(q)) continue;
    const list = byDate.get(it.date) ?? [];
    list.push(it);
    byDate.set(it.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      title: historyDayTitle(date, currentYear),
      items: list.sort(
        (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (a.time ?? "").localeCompare(b.time ?? ""),
      ),
    }));
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Cuántos de cada tipo (para los filtros de arriba). */
export function historyCounts(items: HistoryItem[]): { kind: HistoryKind; count: number }[] {
  const n = new Map<HistoryKind, number>();
  for (const it of items) n.set(it.kind, (n.get(it.kind) ?? 0) + 1);
  return ORDER.filter((k) => n.has(k)).map((kind) => ({ kind, count: n.get(kind)! }));
}

/** Texto para compartir/copiar: nombre, recuento y cada noche con sus apuntes. */
export function historyToText(name: string, days: HistoryDay[], heading = `👤 HISTORIAL DE ${name.toUpperCase()}`): string {
  const L: string[] = [heading];
  const total = days.reduce((s, d) => s + d.items.length, 0);
  if (days.length > 0) {
    L.push(`${total} ${total === 1 ? "apunte" : "apuntes"} · ${days[days.length - 1]!.title} – ${days[0]!.title}`);
  } else {
    L.push("Sin apuntes");
  }
  for (const d of days) {
    L.push("", `📅 ${d.title}`);
    for (const it of d.items) {
      const time = it.time ? `${it.time} · ` : "";
      const photos = it.photos ? ` (📷 ${it.photos})` : "";
      L.push(`• ${time}${it.who ? `${it.who} · ` : ""}${it.label}: ${it.text}${photos}`);
    }
  }
  return L.join("\n");
}

// Historial de un empleado (Informe → buscar empleado): todo lo apuntado o hablado con él, agrupado por noche.
// Puro y sin zod (se usa también en el cliente para exportar).
import { type DateStr, formatDayLong } from "./dates";

export type HistoryKind =
  | "night-note" // nota de la noche (Informe) sobre él
  | "task" // tarea de la noche sobre él
  | "day-note" // nota del día en su ficha de Hoy
  | "file-note" // nota de su ficha (Ajustes → Empleados): nota, incidencia, felicitación, conversación
  | "report" // aviso con foto
  | "absence" // faltó o ausencia con motivo
  | "time" // llegó tarde / se fue antes / se quedó más
  | "overtime" // horas extra
  | "request"; // petición de fiesta / vacaciones

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
}

export interface HistoryDay {
  date: DateStr;
  title: string;
  items: HistoryItem[];
}

export const KIND_META: Record<HistoryKind, { label: string; color: string }> = {
  "night-note": { label: "Nota", color: "#64748b" },
  task: { label: "Tarea", color: "#d97706" },
  "day-note": { label: "Nota del día", color: "#64748b" },
  "file-note": { label: "Ficha", color: "#4f46e5" },
  report: { label: "Aviso", color: "#0ea5e9" },
  absence: { label: "Ausencia", color: "#dc2626" },
  time: { label: "Horario", color: "#d97706" },
  overtime: { label: "Horas extra", color: "#0a84ff" },
  request: { label: "Petición", color: "#16a34a" },
};

/** Orden dentro de una noche: primero lo hablado (notas), luego lo que pasó. */
const ORDER: HistoryKind[] = ["file-note", "night-note", "day-note", "task", "report", "absence", "time", "overtime", "request"];

/** "Lunes 28 sep" (+ año si no es el actual). */
export function historyDayTitle(date: DateStr, currentYear: number): string {
  const y = Number(date.slice(0, 4));
  return y === currentYear ? formatDayLong(date) : `${formatDayLong(date)} ${y}`;
}

/** Agrupa por noche, de la más reciente a la más antigua. `query` filtra por texto (sin acentos ni mayúsculas). */
export function groupHistory(items: HistoryItem[], currentYear: number, query = ""): HistoryDay[] {
  const q = normalize(query.trim());
  const byDate = new Map<DateStr, HistoryItem[]>();
  for (const it of items) {
    if (q && !normalize(`${it.label} ${it.text}`).includes(q)) continue;
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

/** Cuántos de cada tipo (para el resumen de arriba). */
export function historyCounts(days: HistoryDay[]): { kind: HistoryKind; count: number }[] {
  const n = new Map<HistoryKind, number>();
  for (const d of days) for (const it of d.items) n.set(it.kind, (n.get(it.kind) ?? 0) + 1);
  return ORDER.filter((k) => n.has(k)).map((kind) => ({ kind, count: n.get(kind)! }));
}

/** Texto para compartir/copiar: nombre, recuento y cada noche con sus apuntes. */
export function historyToText(name: string, days: HistoryDay[]): string {
  const L: string[] = [`👤 HISTORIAL DE ${name.toUpperCase()}`];
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
      L.push(`• ${time}${it.label}: ${it.text}${photos}`);
    }
  }
  return L.join("\n");
}

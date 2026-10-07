/**
 * LA nota (NightNote): un solo tipo de apunte para toda la app. Se escribe desde Hoy (⋯ o la ficha de una persona),
 * Informe y la ficha del empleado, y se ve en el Informe, el historial (lupa) y la ficha.
 * Puro y sin zod: se usa también en el cliente (los esquemas están en lib/notes-schema.ts).
 */
import type { DateStr } from "./dates";
import type { ReportPhotoView } from "./report-format";

/** Tipo de nota tal como lo elige el usuario. TASK = tarea pendiente (se marca hecha). */
export const NOTE_TYPES = ["NOTE", "TASK", "INCIDENT", "PRAISE", "TALK", "REQUEST"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_META: Record<NoteType, { label: string; color: string }> = {
  NOTE: { label: "Nota", color: "#64748b" },
  TASK: { label: "Tarea", color: "#d97706" },
  INCIDENT: { label: "Incidencia", color: "#dc2626" },
  PRAISE: { label: "Felicitación", color: "#16a34a" },
  TALK: { label: "Conversación", color: "#4f46e5" },
  REQUEST: { label: "Petición", color: "#0891b2" },
};

export const MAX_NOTE_TEXT = 2000;

export function isNoteType(v: string): v is NoteType {
  return (NOTE_TYPES as readonly string[]).includes(v);
}

/** BD (kind + category) → tipo. */
export function noteTypeOf(kind: string, category: string): NoteType {
  if (kind === "TASK") return "TASK";
  return isNoteType(category) && category !== "TASK" ? category : "NOTE";
}

/** Tipo → BD (kind + category). */
export function noteTypeToDb(type: NoteType): { kind: "INFO" | "TASK"; category: string } {
  return type === "TASK" ? { kind: "TASK", category: "NOTE" } : { kind: "INFO", category: type };
}

export interface NoteView {
  id: string;
  date: DateStr;
  /** "22:15" si se apuntó la hora. */
  time: string | null;
  type: NoteType;
  /** Tarea hecha. */
  done: boolean;
  text: string;
  employeeId: string | null;
  employeeName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  photos: ReportPhotoView[];
}

/** "Ana · Droguería", "Droguería", "Ana" o "General". */
export function noteWho(n: { employeeName: string | null; departmentName: string | null }): string {
  return [n.employeeName, n.departmentName].filter(Boolean).join(" · ") || "General";
}

/** Etiqueta del tipo (las tareas dicen si están hechas). */
export function noteLabel(n: Pick<NoteView, "type" | "done">): string {
  if (n.type === "TASK") return n.done ? "Tarea hecha" : "Tarea pendiente";
  return NOTE_TYPE_META[n.type].label;
}

/** Una línea para compartir: "☐ Ana: texto [Pasillo 3] (📷 2)". */
export function noteLine(n: NoteView, withWho = true): string {
  const mark = n.type === "TASK" ? (n.done ? "✅ " : "☐ ") : n.type === "NOTE" ? "" : `${NOTE_TYPE_META[n.type].label}: `;
  const who = withWho && (n.employeeName || n.departmentName) ? `${noteWho(n)}: ` : "";
  const where = n.sectionName ? ` [${n.sectionName}]` : "";
  const photos = n.photos.length > 0 ? ` (📷 ${n.photos.length})` : "";
  return `${who}${mark}${n.text.replace(/\s*\n\s*/g, " ")}${where}${photos}`;
}

/** Orden dentro de una noche: generales primero, luego por hora y por creación (ya vienen así de la BD). */
export function sortNotes(notes: NoteView[]): NoteView[] {
  const general = (n: NoteView) => (n.employeeId || n.departmentId ? 1 : 0);
  return [...notes].sort((a, b) => general(a) - general(b));
}

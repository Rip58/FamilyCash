/** Control de pasillos: tipos y cuentas puras (sin base de datos, para usar también en el cliente). */

export interface AisleInfo {
  /** "HH:mm" en que empezó el departamento. */
  startTime: string | null;
  /** "HH:mm" en que acabó (opcional). */
  endTime: string | null;
  /** Palés subidos al departamento. */
  palletsUp: number | null;
  /** Palés que han vuelto a bajar SIN TOCAR (tal como subieron del camión): no cuentan como hechos. */
  palletsDown: number | null;
  /** Palés bajados por sobrante (no hay sitio donde guardarlos): se dan por hechos. */
  palletsSurplus: number | null;
  /** Nota del pasillo esa noche. */
  note: string | null;
  /** Oculto con el ojo SOLO esa noche: no sale en el resumen del informe. */
  hidden: boolean;
  /** Quién lo ha hecho (solo en pasillos con sección; en un departamento sale de sus puestos). */
  employeeIds: string[];
}

export const MAX_AISLE_NOTE = 1000;

export const MAX_PALLETS = 999;

/** Clave de una fila del control de pasillos: el departamento, o «departamento:sección» si se ha separado en pasillos. */
export function aisleKey(departmentId: string, sectionId: string | null): string {
  return sectionId ? `${departmentId}:${sectionId}` : departmentId;
}

/**
 * Palés hechos: subidos − bajados sin tocar. Los sobrantes NO se restan (se bajan por falta de sitio, pero están
 * hechos). null si no se han apuntado los subidos.
 */
export function palletsDone(up: number | null, untouched: number | null): number | null {
  if (up === null) return null;
  return Math.max(0, up - (untouched ?? 0));
}

/** Texto de un campo numérico → entero 0–999 o null si está vacío/no válido. */
export function parsePallets(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  return Math.min(MAX_PALLETS, Number(t));
}

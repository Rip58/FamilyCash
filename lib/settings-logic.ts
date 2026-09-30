/** Lógica pura de Ajustes (sin acceso a datos): códigos, reordenación, paleta. */

export const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#0ea5e9", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
] as const;

export const PROTECTED_STATUS_CODES = ["WORK", "OFF"] as const;

export function isProtectedStatus(code: string): boolean {
  return (PROTECTED_STATUS_CODES as readonly string[]).includes(code);
}

/** "Fiesta retribuida" -> "FIESTA_RETRIBUIDA" (sin acentos, mayúsculas, guiones bajos). */
export function slugCode(label: string): string {
  const s = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "ESTADO";
}

/** Genera un code único a partir de la etiqueta (añade _2, _3… si ya existe). */
export function uniqueCode(label: string, existing: readonly string[]): string {
  const base = slugCode(label);
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** Mueve el elemento en `from` a la posición `to` (devuelve una copia). */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

/** Reordena ids moviendo `activeId` a la posición de `overId`. */
export function reorderIds(ids: readonly string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  return arrayMove(ids, from, to);
}

/** Lista ordenada de ids -> sortOrder 0..n-1. */
export function sortOrderUpdates(ids: readonly string[]): { id: string; sortOrder: number }[] {
  return ids.map((id, sortOrder) => ({ id, sortOrder }));
}

/** sortOrder para añadir un elemento al final de una lista. */
export function nextSortOrder(orders: readonly number[]): number {
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/** Validación simple de color hex #rrggbb. */
export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/** ¿Hora "HH:mm" válida? */
export function isTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

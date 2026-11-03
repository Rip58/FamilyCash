/** Control de pasillos: tipos y cuentas puras (sin base de datos, para usar también en el cliente). */

export interface AisleInfo {
  /** "HH:mm" en que empezó el departamento. */
  startTime: string | null;
  /** Palés subidos al departamento. */
  palletsUp: number | null;
  /** Palés que han vuelto a bajar sin hacer. */
  palletsDown: number | null;
}

export const MAX_PALLETS = 999;

/** Palés que se han hecho de verdad: subidos − bajados (null si no se han apuntado los subidos). */
export function palletsDone(up: number | null, down: number | null): number | null {
  if (up === null) return null;
  return Math.max(0, up - (down ?? 0));
}

/** Texto de un campo numérico → entero 0–999 o null si está vacío/no válido. */
export function parsePallets(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  return Math.min(MAX_PALLETS, Number(t));
}

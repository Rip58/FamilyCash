/** Fotos de las notas: tipos y utilidades puras SIN zod (se usan en componentes de cliente; el esquema está en lib/reports.ts). */

export interface ReportPhotoView {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
}

export function photoCountLabel(n: number): string {
  return n === 1 ? "1 foto" : `${n} fotos`;
}

/**
 * Fecha límite para "borrar fotos anteriores a N meses": las de noches con `date` < cutoff se borran.
 * Resta N meses naturales a `today`.
 */
export function purgeCutoff(today: string, months: number): string {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/**
 * Importar el cuadrante semanal desde una imagen con IA: tipos y utilidades SIN zod
 * (los usa también la vista previa en el cliente). Esquemas y llamadas a la IA: lib/ai-import.ts y lib/ai-providers.ts.
 */
import { normalize } from "./protocol-markdown";

export type AiProvider = "claude" | "openai" | "gemini";
export const AI_PROVIDERS: { id: AiProvider; label: string; envVar: string; free?: boolean }[] = [
  { id: "claude", label: "Claude (Anthropic)", envVar: "ANTHROPIC_API_KEY" },
  { id: "openai", label: "ChatGPT (OpenAI)", envVar: "OPENAI_API_KEY" },
  { id: "gemini", label: "Gemini (Google)", envVar: "GEMINI_API_KEY", free: true },
];
export const isAiProvider = (v: unknown): v is AiProvider => v === "claude" || v === "openai" || v === "gemini";

export const aiProviderLabel = (p: string) => AI_PROVIDERS.find((x) => x.id === p)?.label.split(" (")[0] ?? "Claude";

/** Columnas lunes → domingo tal y como las devuelve la IA. */
export const DAY_KEYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** Una fila de la vista previa: el nombre leído en la imagen, el empleado asignado y el estado de cada día. */
export interface ImportRow {
  name: string;
  employeeId: string | null;
  /** statusTypeId por día (lunes → domingo); null = no se entendió / dejar como está. */
  cells: (string | null)[];
}

export interface ImportResult {
  provider: AiProvider;
  model: string;
  /** Lunes de la semana que la IA cree ver en la imagen (si aparece), para avisar si no coincide. */
  detectedWeekStart: string | null;
  rows: ImportRow[];
  notes: string | null;
}

/** Puntuación de parecido entre un nombre leído y un empleado (0 = nada, 100 = igual). */
export function nameScore(read: string, employee: { name: string; alias?: string | null }): number {
  const r = normalize(read).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
  if (!r) return 0;
  const full = normalize(employee.name).replace(/\s+/g, " ").trim();
  const alias = normalize(employee.alias ?? "").trim();
  if (r === full || (alias && r === alias)) return 100;
  const rw = r.split(" ");
  const fw = full.split(" ");
  // Cada palabra leída debe estar en el nombre (entera, o como inicial/abreviatura de un apellido):
  // "Ana G." / "Ana Garcia" / "Garcia Ana"
  const covers = (w: string, i: number) => fw.some((f, j) => f === w || (j > 0 && i > 0 && f.startsWith(w)));
  // Con tolerancia: un apellido largo con una letra mal leída ("Colldefons"), o la última palabra
  // cortada por la celda del Excel ("AYAZO BALI" por "Ayazo Baldovino").
  const roughly = (w: string, i: number) =>
    i > 0 &&
    fw.some(
      (f, j) =>
        j > 0 &&
        ((w.length >= 5 && f.length >= 5 && editDistance(w, f) <= 1) ||
          (i === rw.length - 1 && rw.length >= 3 && commonPrefix(w, f) >= 3)),
    );
  if (rw.length >= 2) {
    if (rw.every(covers)) return 90;
    // El Excel trae algún apellido más que la app ("JOSE ALEXANDER ROMAN URREA" por "Jose Alexander Roman").
    if (fw.length >= 2 && fw.every((f) => rw.includes(f))) return 85;
    return rw.every((w, i) => covers(w, i) || roughly(w, i)) ? 85 : 0;
  }
  if (fw[0] === rw[0] || alias === rw[0]) return 80;
  return 0;
}

/**
 * Empleado más parecido a un nombre leído. Devuelve null si no hay ninguno claro
 * (puntuación baja o empate entre dos personas, p. ej. dos "Alejandro").
 */
export function matchEmployee<E extends { id: string; name: string; alias?: string | null }>(
  read: string,
  employees: E[],
  taken: Set<string> = new Set(),
): E | null {
  const scored = employees
    .filter((e) => !taken.has(e.id))
    .map((e) => ({ e, s: nameScore(read, e) }))
    .filter((x) => x.s >= 60)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[1]!.s === scored[0]!.s) return null;
  return scored[0]!.e;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Distancia de edición (Levenshtein) entre dos palabras cortas. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

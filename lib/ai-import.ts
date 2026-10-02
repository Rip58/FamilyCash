/**
 * Importar el cuadrante semanal desde una imagen con IA: esquema de la respuesta (zod), instrucciones
 * y conversión a filas de la vista previa. Puro (sin llamadas de red); las llamadas están en lib/ai-providers.ts.
 */
import { z } from "zod";
import { DAY_KEYS, type ImportRow, matchEmployee } from "./ai-import-format";
import { type DateStr, formatDayMonth, weekDays } from "./dates";
import type { EmployeeLite, StatusTypeLite } from "./schedule";

export * from "./ai-import-format";

/** Valor de celda cuando no se entiende lo que pone. */
export const UNKNOWN = "?";

/** Esquema que debe rellenar la IA (salida estructurada). Los códigos de estado y los ids salen de la BD. */
export function importSchema(statusCodes: string[]) {
  // Texto libre (no enum): si la IA devuelve algo fuera de la lista no falla toda la lectura;
  // los códigos desconocidos quedan como "no se entiende" en la vista previa.
  const code = z.string().describe(`Uno de: ${[...statusCodes, UNKNOWN].join(", ")}`);
  const days = z.object(Object.fromEntries(DAY_KEYS.map((k) => [k, code])) as Record<(typeof DAY_KEYS)[number], typeof code>);
  return z.object({
    week_monday: z
      .string()
      .describe('Fecha del lunes de la semana si aparece en la imagen ("YYYY-MM-DD"); cadena vacía si no aparece.'),
    rows: z.array(
      z.object({
        name: z.string().describe("Nombre tal y como aparece en la imagen."),
        employee_id: z
          .string()
          .describe("id del empleado de la lista que corresponde a ese nombre; cadena vacía si no estás seguro."),
        days: days,
      }),
    ),
    notes: z.string().describe("Dudas o celdas que no se leen bien; cadena vacía si no hay."),
  });
}
export type ImportOutput = z.infer<ReturnType<typeof importSchema>>;

/** Instrucciones para la IA: qué hay en la imagen y cómo traducir cada celda a un estado de la app. */
export function importPrompt(input: {
  weekStart: DateStr;
  statusTypes: StatusTypeLite[];
  employees: EmployeeLite[];
}): string {
  const days = weekDays(input.weekStart);
  const statuses = input.statusTypes
    .filter((s) => s.active !== false)
    .map((s) => `- ${s.code}: ${s.label}${s.isWorking ? " (trabaja)" : " (no trabaja)"}`)
    .join("\n");
  const people = input.employees
    .filter((e) => e.active)
    .map((e) => `- ${e.id}: ${e.name}${e.alias ? ` (alias ${e.alias})` : ""}`)
    .join("\n");
  return `La imagen es el cuadrante de turnos (planning) del turno de noche de una tienda, normalmente una captura o foto de un Excel: una fila por persona y una columna por día.

Transcribe la semana del ${formatDayMonth(days[0]!)} (lunes) al ${formatDayMonth(days[6]!)} (domingo). Devuelve una fila por cada persona que aparezca, con lo que pone cada día de lunes (L) a domingo (D), aunque en la imagen las columnas estén en otro orden.

Traduce cada celda a uno de estos estados de la app:
${statuses}

Convenciones habituales: un horario (p. ej. "22-6", "21:30-06:30") o "T" significa que trabaja (WORK); "L", "F", "Libre", "Descanso" o una celda de libranza es fiesta (OFF); "V" o "Vac" vacaciones (VACATION); "B", "Baja" o "IT" baja (SICK); "R" o "FR" fiesta retribuida (PAID_OFF) si ese estado existe. Si una celda está vacía o no se entiende, usa "${UNKNOWN}" y explícalo en notes. Si hay una leyenda de colores en la imagen, úsala.

Empleados de la app (asigna employee_id solo si el nombre corresponde claramente a esa persona; si no, deja employee_id vacío):
${people}

No inventes filas ni personas: transcribe solo lo que se ve.`;
}

/** Convierte la respuesta de la IA en filas de la vista previa (estado por día y empleado asignado). */
export function toImportRows(out: ImportOutput, employees: EmployeeLite[], statusTypes: StatusTypeLite[]): ImportRow[] {
  const byCode = new Map(statusTypes.map((s) => [s.code.toUpperCase(), s.id]));
  const active = employees.filter((e) => e.active);
  const known = new Set(active.map((e) => e.id));
  const taken = new Set<string>();
  const rows: ImportRow[] = out.rows
    .filter((r) => r.name.trim())
    .map((r) => {
      let employeeId: string | null = r.employee_id && known.has(r.employee_id) && !taken.has(r.employee_id) ? r.employee_id : null;
      employeeId ??= matchEmployee(r.name, active, taken)?.id ?? null;
      if (employeeId) taken.add(employeeId);
      return {
        name: r.name.trim(),
        employeeId,
        cells: DAY_KEYS.map((k) => byCode.get((r.days[k] ?? "").trim().toUpperCase()) ?? null),
      };
    });
  return rows;
}

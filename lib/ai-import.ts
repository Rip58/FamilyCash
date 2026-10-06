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
        colors: z
          .string()
          .describe(
            'ANTES de rellenar days: color de las casillas SIN horas de esta fila y a qué casilla de la leyenda se parece, p. ej. "L-V granate oscuro = VACANCES; S-D verde = DESCANS" o "L-D rojo vivo = BAIXA". Cadena vacía si trabaja todos los días.',
          ),
        days: days,
      }),
    ),
    notes: z.string().describe("Dudas o celdas que no se leen bien; cadena vacía si no hay."),
  });
}
export type ImportOutput = z.infer<ReturnType<typeof importSchema>>;
/** Lo que usa la vista previa (`colors` es solo para que la IA mire el color antes de decidir). */
export type ImportOutputLite = Omit<ImportOutput, "rows"> & { rows: (Omit<ImportOutput["rows"][number], "colors"> & { colors?: string })[] };

/** Instrucciones para la IA: qué hay en la imagen y cómo traducir cada celda a un estado de la app. */
export function importPrompt(input: {
  weekStart: DateStr;
  statusTypes: StatusTypeLite[];
  employees: EmployeeLite[];
  /** Nº de imágenes enviadas (partes de la misma semana). */
  imageCount?: number;
}): string {
  const days = weekDays(input.weekStart);
  const active = input.statusTypes.filter((s) => s.active !== false);
  const codes = new Set(active.map((s) => s.code));
  const statuses = active.map((s) => `- ${s.code}: ${s.label}${s.isWorking ? " (trabaja)" : " (no trabaja)"}`).join("\n");
  const people = input.employees
    .filter((e) => e.active)
    .map((e) => `- ${e.id}: ${e.name}${e.alias ? ` (alias ${e.alias})` : ""}`)
    .join("\n");
  // Estado de la app para cada color: por nombre (p. ej. un estado «Suspensión» creado en Ajustes) o por código;
  // si no hay ninguno, "?" (que la persona lo elija en la vista previa).
  const plain = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const byLabel = (word: string) => active.find((st) => plain(st.label).includes(word))?.code;
  const or = (...c: string[]) => c.find((x) => codes.has(x)) ?? UNKNOWN;
  const named = (word: string, ...fallback: string[]) => byLabel(word) ?? or(...fallback);
  const n = input.imageCount ?? 1;
  const year = input.weekStart.slice(0, 4);
  return `${n > 1 ? `Te paso ${n} imágenes: son partes de LA MISMA semana del mismo cuadrante (por ejemplo la parte de arriba y la de abajo de la hoja, que puede repetir alguna fila). Junta todas las personas en una sola lista, en el orden en que aparecen (primero la imagen 1), sin repetir a nadie. La cabecera con los días y la leyenda de colores puede salir solo en una de ellas: vale para todas. Pueden venir en cualquier orden (p. ej. primero la parte de abajo): ordénalas por los números de fila del Excel de la izquierda (la de la cabecera va primero). Si una persona sale en las dos (fila del corte), ponla UNA vez juntando sus días.` : "La imagen es el cuadrante de turnos (planning) del turno de noche de una tienda."}

Es una foto o captura de un Excel (puede estar en catalán) con una fila por persona y una columna por día, de lunes a domingo: DILLUNS/Lunes (L), DIMARTS/Martes (M), DIMECRES/Miércoles (X), DIJOUS/Jueves (J), DIVENDRES/Viernes (V), DISSABTE/Sábado (S), DIUMENGE/Domingo (D). Transcribe la semana del ${formatDayMonth(days[0]!)} (lunes) al ${formatDayMonth(days[6]!)} (domingo) de ${year}. Si la cabecera muestra fechas (p. ej. "5-oct"), el año es ${year}; devuelve en week_monday la fecha del lunes que veas.

CÓMO ESTÁ HECHA LA HOJA
- Cada persona ocupa un bloque de 3 filas: dos filas con horas de entrada/salida (p. ej. "21,50 | 24,00" y "1,00 | 6,50", es decir 21:30–24:00 y 01:00–06:30) y una tercera con las horas del día (p. ej. "8,00"). A la derecha hay una columna TOTAL con las horas de la semana.
- A la izquierda puede haber una columna de sección cortada (p. ej. "POSICIO N…", "REPOSICIO NIT"): NO es parte del nombre. El nombre es el de la columna de empleado (p. ej. "ALEJANDRO GOMEZ"). Si está cortado, cópialo tal cual se ve.
- Un día con horas escritas (cualesquiera: 21,50/24,00, 21,00/24,00, 26,50/29,00, 12,00/17,50…) y horas del día mayores que 0 = trabaja (${or("WORK")}), aunque el horario sea distinto del habitual o haga más horas (8,50, 13,00…).
- Un día sin horas, con las casillas pintadas de un color = ausencia: el tipo lo dice el COLOR (las horas del día suelen salir 0,00).
- Un día CON el horario escrito (21,50/24,00…) pero con la casilla de horas del día VACÍA (sin 8,00 ni 0,00) y sin color = esa persona FALTÓ ese día → ${or("ABSENT")}. Lo confirma el TOTAL: le faltan esas 8 h. No es fiesta (la fiesta siempre va pintada de verde).

LEYENDA DE COLORES HABITUAL (si en la imagen hay leyenda, manda la de la imagen)
- Verde (claro o pistacho) = DESCANS / descanso → ${or("OFF")}
- Amarillo = FESTIU CALENDARI / festivo del calendario → ${named("festivo", "PAID_OFF", "OFF")}
- Rojo OSCURO, granate = VACANCES / vacaciones → ${or("VACATION")}
- Rojo VIVO, brillante = BAIXA / baja → ${or("SICK")}
- Azul claro, celeste = RECUPERABLE → ${named("recuperable", "OFF")}
- Naranja = PERMÍS RETRIBUÏT / permiso retribuido → ${or("PAID_OFF")}
- Morado, lila = PERMÍS NO RETRIBUÏT → ${named("no retribuid", "ABSENT")}
- Azul OSCURO, intenso = SUSPENSIÓ / suspensión → ${named("suspension", "ABSENT")}
LOS DOS ROJOS (se confunden mucho, fíjate bien):
- VACANCES = granate / rojo OSCURO, tirando a marrón (como #A52A2A–#C00000). Más apagado.
- BAIXA = rojo VIVO, puro, brillante (como #FF0000, rojo semáforo). Más claro y saturado.
- Compara cada fila roja con las casillas VACANCES y BAIXA de la leyenda (si la leyenda está en otra imagen, úsala igual) y con las otras filas rojas: si en la hoja hay dos rojos distintos, el más oscuro es VACANCES y el más vivo es BAIXA. No pongas el mismo estado a dos rojos que se ven distintos.
- Escribe primero en "colors" qué rojo ves y con qué casilla de la leyenda coincide, y luego pon el código en days de acuerdo con eso.
Distingue también azul oscuro (suspensión) de azul claro (recuperable) comparándolos con la leyenda.

COMPRUEBA CADA FILA: la primera cifra de TOTAL son las horas trabajadas de la semana; debe cuadrar con la suma de las horas de los días que marcas como trabajo (p. ej. 48,00 = 6 noches de 8 h; 40,00 = 5; 0,00 = ninguna). Si no cuadra, vuelve a mirar esa fila.

Estados de la app (usa SOLO estos códigos):
${statuses}
Si una persona tiene la fila ENTERA en blanco (sin horas ni color, TOTAL 0,00), pon "${UNKNOWN}" en todos sus días y dilo en notes (puede que ya no trabaje). Si una casilla está vacía, no se lee o su color no corresponde a ningún estado de la lista, usa "${UNKNOWN}" y explícalo en notes (persona y día).

Empleados de la app (asigna employee_id solo si el nombre corresponde claramente a esa persona; si no, deja employee_id vacío):
${people}

No inventes filas ni personas: transcribe solo lo que se ve. notes: dudas concretas, en español y breves (cadena vacía si no hay).`;
}

/** Convierte la respuesta de la IA en filas de la vista previa (estado por día y empleado asignado). */
export function toImportRows(out: ImportOutputLite, employees: EmployeeLite[], statusTypes: StatusTypeLite[]): ImportRow[] {
  const byCode = new Map(statusTypes.map((s) => [s.code.toUpperCase(), s.id]));
  const active = employees.filter((e) => e.active);
  const known = new Set(active.map((e) => e.id));
  // Quien ya no está activo en la app (p. ej. ha plegado) no sale en la vista previa aunque siga en el Excel.
  const inactive = employees.filter((e) => !e.active);
  const taken = new Set<string>();
  const rows: ImportRow[] = [];
  const rowOf = new Map<string, ImportRow>();
  for (const r of out.rows) {
    if (!r.name.trim()) continue;
    if (inactive.length > 0 && !matchEmployee(r.name, active) && matchEmployee(r.name, inactive)) continue;
    const cells = DAY_KEYS.map((k) => byCode.get((r.days[k] ?? "").trim().toUpperCase()) ?? null);
    // Con 2 imágenes la fila del corte puede salir en las dos: si ya está esa persona, se juntan los días.
    const same = (r.employee_id && known.has(r.employee_id) ? r.employee_id : null) ?? matchEmployee(r.name, active)?.id ?? null;
    const prev = same ? rowOf.get(same) : undefined;
    if (prev) {
      prev.cells = prev.cells.map((c, i) => c ?? cells[i] ?? null);
      continue;
    }
    let employeeId: string | null = r.employee_id && known.has(r.employee_id) && !taken.has(r.employee_id) ? r.employee_id : null;
    employeeId ??= matchEmployee(r.name, active, taken)?.id ?? null;
    if (employeeId) taken.add(employeeId);
    const row = { name: r.name.trim(), employeeId, cells };
    if (employeeId) rowOf.set(employeeId, row);
    rows.push(row);
  }
  return rows;
}

/** Gemini acepta un subconjunto de JSON Schema (OpenAPI): solo tipo, propiedades, requeridos, items y descripción. */
export function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;
  const n = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof n.type === "string") out.type = n.type;
  if (typeof n.description === "string") out.description = n.description;
  if (n.items) out.items = geminiSchema(n.items);
  if (n.properties && typeof n.properties === "object") {
    out.properties = Object.fromEntries(Object.entries(n.properties).map(([k, v]) => [k, geminiSchema(v)]));
    out.required = Object.keys(n.properties);
    out.propertyOrdering = Object.keys(n.properties);
  }
  return out;
}

/**
 * Gemini retira modelos ("This model models/gemini-2.5-flash is no longer available… use models/gemini-3.8-flash"):
 * el modelo a probar en su lugar. Primero el que sugiere el propio error; si no, el Flash más nuevo de la lista
 * de la cuenta (sin "lite"/"preview" si hay otro). null si no hay alternativa.
 */
export function geminiFallbackModel(message: string, available: string[], tried: string): string | null {
  const suggested = /use\s+(?:models\/)?(gemini-[\w.-]+)/i.exec(message)?.[1]?.replace(/[.,;]+$/, "");
  if (suggested && suggested !== tried) return suggested;
  const flash = available
    .filter((id) => /flash/i.test(id) && id !== tried)
    .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  return flash.find((id) => !/(lite|preview|exp)/i.test(id)) ?? flash[0] ?? null;
}

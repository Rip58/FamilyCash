/**
 * Módulos del informe de la noche: lo que sale en el Informe y al compartirlo (imagen, PDF y texto). Por defecto salen
 * todos; en la página de Informe se pueden quitar los que esa noche no hacen falta (`?sin=pasillos,notas`).
 * Puro y sin zod: lo usan el servidor y el cliente.
 */
export const REPORT_MODULES = [
  { key: "working", label: "Trabajan", hint: "Quién ha trabajado" },
  { key: "off", label: "Fiesta", hint: "Quién libra" },
  { key: "away", label: "Vacaciones y bajas", hint: "Ausencias previstas" },
  { key: "missing", label: "Faltan", hint: "Quién no ha venido (y su motivo)" },
  { key: "times", label: "Horarios", hint: "Llegadas tarde y salidas" },
  { key: "overtime", label: "Horas extra", hint: "Horas extra y retrasos" },
  { key: "notifications", label: "Notificaciones", hint: "Con la firma del empleado" },
  { key: "notes", label: "Notas de la noche", hint: "Notas, incidencias y fotos" },
  { key: "aisles", label: "Pasillos", hint: "Tabla de palés, horas y personal" },
] as const;

export type ReportModule = (typeof REPORT_MODULES)[number]["key"];

const KEYS = REPORT_MODULES.map((m) => m.key) as readonly string[];

export function isReportModule(v: string): v is ReportModule {
  return KEYS.includes(v);
}

/** `?sin=` (módulos quitados, separados por comas) → lista válida y sin repetidos. */
export function parseHiddenModules(param: string | string[] | undefined): ReportModule[] {
  const raw = Array.isArray(param) ? param.join(",") : (param ?? "");
  const out: ReportModule[] = [];
  for (const k of raw.split(",")) {
    const key = k.trim();
    if (isReportModule(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Módulos quitados → valor de `?sin=` (vacío si salen todos), en el orden de la lista. */
export function hiddenModulesParam(hidden: readonly ReportModule[]): string {
  return REPORT_MODULES.filter((m) => hidden.includes(m.key))
    .map((m) => m.key)
    .join(",");
}

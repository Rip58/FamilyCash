/** Pestañas de la ficha del empleado (?tab=). */
export type FileTab = "datos" | "historial";

export function isFileTab(v: string | undefined): v is FileTab {
  return v === "datos" || v === "historial";
}

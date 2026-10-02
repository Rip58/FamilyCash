import type { DateStr } from "@/lib/dates";

export type WeekViewMode = "dias" | "personas";

export interface GridStatus {
  id: string;
  code: string;
  label: string;
  color: string;
  isWorking: boolean;
  active: boolean;
  sortOrder: number;
}

export interface GridCell {
  statusId: string;
  reason: string | null;
  extraMinutes: number | null;
  extraNote: string | null;
  /** Lo validado en Hoy si no cuadra con el planning (null = cuadra). */
  actual: string | null;
  /** Resumen de la petición PENDIENTE que cubre esta celda (null = ninguna). */
  pending: string | null;
}

export interface GridRow {
  employeeId: string;
  name: string;
  alias: string | null;
  departmentName: string | null;
  cells: GridCell[];
}

export interface GridGroup {
  id: string;
  name: string;
  color: string | null;
  rows: GridRow[];
}

export interface PeopleGridData {
  days: DateStr[];
  today: DateStr;
  statuses: GridStatus[];
  groups: GridGroup[];
  daysOffPerWeek: number;
}

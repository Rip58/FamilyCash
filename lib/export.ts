/** Exportación CSV de DayEntry (días efectivos) — lógica pura. */
import { type DateStr, addDays } from "./dates";
import {
  type DayEntryLite,
  type DepartmentLite,
  type EmployeeLite,
  type StatusTypeLite,
  getEffectiveDay,
} from "./schedule";

export const CSV_HEADER = [
  "fecha", "empleado", "departamento", "estado", "motivo",
  "llega", "sale", "motivo horario", "nota", "tramos",
  "horas extra (min)", "motivo horas extra",
] as const;

export const MAX_EXPORT_DAYS = 366;
export const CSV_DELIMITER = ";";

export function csvEscape(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  // BOM para que Excel abra UTF-8 correctamente.
  return "﻿" + rows.map((r) => r.map(csvEscape).join(CSV_DELIMITER)).join("\r\n") + "\r\n";
}

export function daysInRange(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to && out.length <= MAX_EXPORT_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface ExportInput {
  from: DateStr;
  to: DateStr;
  employees: EmployeeLite[];
  departments: DepartmentLite[];
  statusTypes: StatusTypeLite[];
  sections: { id: string; name: string }[];
  entries: DayEntryLite[];
}

/** Filas del CSV (cabecera incluida). Incluye los días por defecto vía getEffectiveDay. */
export function buildExportRows(input: ExportInput): string[][] {
  const { from, to, employees, departments, statusTypes, sections, entries } = input;
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const key = (e: string, d: string) => `${e}|${d}`;
  const entryMap = new Map(entries.map((e) => [key(e.employeeId, e.date), e]));

  const rows: string[][] = [[...CSV_HEADER]];
  for (const date of daysInRange(from, to)) {
    for (const emp of employees) {
      const entry = entryMap.get(key(emp.id, date));
      // Los inactivos solo aparecen los días con entrada.
      if (!emp.active && !entry) continue;
      const day = getEffectiveDay(emp, date, entry, statusTypes);
      const tramos = day.segments
        .map((s) => `${(s.sectionId && sectionName.get(s.sectionId)) || s.label || ""} ${s.start}-${s.end}`.trim())
        .join(" | ");
      rows.push([
        date,
        emp.name,
        (day.departmentId && deptName.get(day.departmentId)) || "",
        day.status.label,
        day.reason ?? "",
        day.arrivedAt ?? "",
        day.leftAt ?? "",
        day.timeReason ?? "",
        day.note ?? "",
        tramos,
        day.extraMinutes ? String(day.extraMinutes) : "",
        day.extraNote ?? "",
      ]);
    }
  }
  return rows;
}

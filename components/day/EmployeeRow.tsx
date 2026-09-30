"use client";

import { leftKind, segmentName, type ShiftTimes } from "@/lib/segments";
import type { DepartmentLite, RosterMember } from "@/lib/schedule";
import { useLongPress } from "./useLongPress";

interface EmployeeRowProps {
  member: RosterMember;
  sectionNames: Map<string, string>;
  departments: Map<string, DepartmentLite>;
  shift: ShiftTimes;
  onOpen: () => void;
  onMove: () => void;
  /** Muestra estado/motivo en vez de secciones (lista de ausentes). */
  showStatus?: boolean;
}

export function EmployeeRow({ member, sectionNames, departments, shift, onOpen, onMove, showStatus }: EmployeeRowProps) {
  const { employee, day } = member;
  const press = useLongPress(onMove, onOpen);
  const habitual = employee.defaultDepartmentId ? departments.get(employee.defaultDepartmentId) : undefined;
  const moved = day.departmentId !== employee.defaultDepartmentId;
  const sections = day.segments.map((s) => segmentName(s, sectionNames));

  return (
    <button
      type="button"
      {...press}
      className="flex min-h-[52px] w-full select-none items-center gap-3 px-4 py-2 text-left [-webkit-touch-callout:none] active:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{employee.name}</span>
        {showStatus ? (
          <span className="block truncate text-[13px] text-muted">
            {day.status.label}
            {day.reason ? ` · ${day.reason}` : ""}
          </span>
        ) : (
          (sections.length > 0 || moved) && (
            <span className="mt-0.5 flex flex-wrap items-center gap-1">
              {sections.map((n, i) => (
                <span key={i} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-muted">
                  {n}
                </span>
              ))}
              {moved && (
                <span className="text-[12px] text-warning">
                  ↪ {habitual ? `de ${habitual.name}` : "movido"}
                </span>
              )}
            </span>
          )
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[13px] text-muted">
        {day.arrivedAt && <span title="Llega tarde">⏰ {day.arrivedAt}</span>}
        {day.leftAt && (
          <span title={leftKind(day.leftAt, shift) === "more" ? "Se queda más" : "Se va antes"}>
            {leftKind(day.leftAt, shift) === "more" ? "➕" : "➖"} {day.leftAt}
          </span>
        )}
        {day.note && <span aria-label="Tiene nota">💬</span>}
      </span>
    </button>
  );
}

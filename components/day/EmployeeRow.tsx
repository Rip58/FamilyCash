"use client";

import { formatOvertime } from "@/lib/overtime";
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
  /** El empleado tiene avisos con foto esa noche. */
  hasReports?: boolean;
  /** Dentro de la burbuja de su departamento: no repetir el nombre del departamento. */
  hideDepartment?: boolean;
  /** Pasar lista: botones ✓/✗ (solo para quien está previsto que trabaje). */
  attendance?: { onPresent: () => void; onAbsent: () => void; onUndo: () => void };
}

const checkBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-[18px] font-bold active:opacity-70 [touch-action:manipulation]";

export function EmployeeRow({ member, sectionNames, departments, shift, onOpen, onMove, showStatus, hasReports, attendance, hideDepartment }: EmployeeRowProps) {
  const { employee, day } = member;
  const press = useLongPress(onMove, onOpen);
  const habitual = employee.defaultDepartmentId ? departments.get(employee.defaultDepartmentId) : undefined;
  const moved = day.departmentId !== employee.defaultDepartmentId;
  const today = !hideDepartment && day.departmentId ? departments.get(day.departmentId) : undefined;
  const sections = day.segments.map((s) => segmentName(s, sectionNames));

  const name = employee.name;
  return (
    <div className="flex items-center">
      <button
        type="button"
        {...press}
        className="flex min-h-[52px] min-w-0 flex-1 select-none items-center gap-3 py-2 pl-4 pr-2 text-left [-webkit-touch-callout:none] active:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{employee.name}</span>
          {showStatus ? (
            <span className="block truncate text-[13px] text-muted">
              {day.status.label}
              {day.reason ? ` · ${day.reason}` : ""}
            </span>
          ) : (
            (sections.length > 0 || today || moved) && (
              <span className="mt-0.5 flex flex-wrap items-center gap-1">
                {today && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted">
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: today.color }} />
                    {today.name}
                  </span>
                )}
                {sections.map((n, i) => (
                  <span key={i} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-muted">
                    {n}
                  </span>
                ))}
                {moved && habitual && <span className="text-[12px] text-warning">↪ de {habitual.name}</span>}
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
          {day.isWorking && (day.extraMinutes ?? 0) > 0 && (
            <span title="Horas extra" className="font-medium text-accent">
              ⏱ {formatOvertime(day.extraMinutes!, true)}
            </span>
          )}
          {day.note && <span aria-label="Tiene nota">💬</span>}
          {hasReports && <span aria-label="Tiene avisos con foto">📷</span>}
        </span>
      </button>
      {attendance && (
        <span className="flex shrink-0 items-center gap-1.5 pr-3">
          {day.present ? (
            <button
              type="button"
              onClick={attendance.onUndo}
              aria-label={`${name} ha venido. Toca para deshacer`}
              className={`${checkBtn} border-success bg-success text-white`}
            >
              ✓
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={attendance.onAbsent}
                aria-label={`${name} no ha venido`}
                className={`${checkBtn} border-danger/50 text-danger`}
              >
                ✗
              </button>
              <button
                type="button"
                onClick={attendance.onPresent}
                aria-label={`${name} ha venido`}
                className={`${checkBtn} border-success/60 text-success`}
              >
                ✓
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

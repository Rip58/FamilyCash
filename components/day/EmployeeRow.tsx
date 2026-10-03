"use client";

import { formatOvertime } from "@/lib/overtime";
import { leftKind, segmentName, type ShiftTimes } from "@/lib/segments";
import type { DepartmentLite, RosterMember } from "@/lib/schedule";
import { tint } from "@/components/ui/icons";
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
  /** En las burbujas de ausencia: ✓ validar (la ausencia es correcta) / ⇄ no cuadra (otro motivo o ha venido). */
  absence?: { onConfirm: () => void; onUndo: () => void; onChange: () => void };
  /** Dentro de la burbuja de su departamento: no repetir el nombre del departamento. */
  hideDepartment?: boolean;
  /** Pasar lista: botones ✓/✗ (solo para quien está previsto que trabaje). */
  attendance?: { onPresent: () => void; onAbsent: () => void; onUndo: () => void };
}

/** Zona táctil de 44px con un círculo visual más pequeño (filas compactas, como en Semana). */
const hit = "flex h-11 w-10 shrink-0 items-center justify-center active:opacity-60 [touch-action:manipulation]";
const dot = "flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold";

export function EmployeeRow({ member, sectionNames, departments, shift, onOpen, onMove, showStatus, hasReports, attendance, hideDepartment, absence }: EmployeeRowProps) {
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
        className="flex min-h-11 min-w-0 flex-1 select-none items-center gap-2 py-1 pl-3.5 pr-1 text-left [-webkit-touch-callout:none] active:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-tight">{employee.name}</span>
          {showStatus ? (
            <span className="block truncate text-[12px] leading-tight text-muted">
              {day.status.label}
              {day.reason ? ` · ${day.reason}` : ""}
            </span>
          ) : (
            (sections.length > 0 || today || moved) && (
              <span className="flex flex-wrap items-center gap-x-1.5 leading-tight">
                {today && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: today.color }} />
                    {today.name}
                  </span>
                )}
                {sections.map((n, i) => (
                  <span key={i} className="text-[12px] text-muted">
                    {n}
                  </span>
                ))}
                {moved && habitual && <span className="text-[12px] text-warning">↪ de {habitual.name}</span>}
              </span>
            )
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted">
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
        {day.planned && (
          <span title={`Planning: ${day.planned.label}`} aria-label={`No cuadra con el planning (${day.planned.label})`}>
            ⚠️
          </span>
        )}
        </span>
      </button>
      {absence && (
        <span className="flex shrink-0 items-center pr-1.5">
          <button type="button" onClick={absence.onChange} aria-label={`No cuadra: cambiar lo de ${name}`} className={hit}>
            <span className={dot} style={{ backgroundColor: tint(day.status.color, 18), color: day.status.color }}>
              ⇄
            </span>
          </button>
          {day.present ? (
            <button
              type="button"
              onClick={absence.onUndo}
              aria-label={`${day.status.label} de ${name} validada. Toca para deshacer`}
              className={hit}
            >
              <span className={`${dot} bg-success text-white`}>✓</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={absence.onConfirm}
              aria-label={`Validar ${day.status.label.toLowerCase()} de ${name}`}
              className={hit}
            >
              <span className={`${dot} bg-success/15 text-success`}>✓</span>
            </button>
          )}
        </span>
      )}
      {attendance && (
        <span className="flex shrink-0 items-center pr-1.5">
          {day.present ? (
            <button type="button" onClick={attendance.onUndo} aria-label={`${name} ha venido. Toca para deshacer`} className={hit}>
              <span className={`${dot} bg-success text-white`}>✓</span>
            </button>
          ) : (
            <>
              <button type="button" onClick={attendance.onAbsent} aria-label={`${name} no ha venido`} className={hit}>
                <span className={`${dot} bg-danger/12 text-danger`}>✗</span>
              </button>
              <button type="button" onClick={attendance.onPresent} aria-label={`${name} ha venido`} className={hit}>
                <span className={`${dot} bg-success/15 text-success`}>✓</span>
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

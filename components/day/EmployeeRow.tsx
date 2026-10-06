"use client";

import { useState } from "react";
import { formatOvertime } from "@/lib/overtime";
import { leftKind, segmentName, type ShiftTimes } from "@/lib/segments";
import { type DepartmentLite, type RosterMember, sameIds } from "@/lib/schedule";
import { cn } from "@/components/ui/cn";
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
  /** Burbuja de departamento en la que está la fila: no se repite ese nombre (null = lista sin grupos). */
  groupId?: string | null;
  /** Pasar lista: botones ✓/✗ (solo para quien está previsto que trabaje). */
  attendance?: { onPresent: () => void; onAbsent: () => void; onUndo: () => void; onMove?: () => void };
}

/** Filas compactas (33px, como pidió el usuario): botón de 33×44px con un círculo visual de 24px. */
const hit = "press flex h-[33px] w-11 shrink-0 items-center justify-center [touch-action:manipulation]";
const dot =
  "flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold transition-colors duration-150 ease-out";

export function EmployeeRow({ member, sectionNames, departments, shift, onOpen, onMove, showStatus, hasReports, attendance, groupId = null, absence }: EmployeeRowProps) {
  const { employee, day } = member;
  // ✓ verde: solo se anima cuando se valida ahora (no al cargar la página con gente ya validada).
  const [wasPresent, setWasPresent] = useState(day.present);
  const [justValidated, setJustValidated] = useState(false);
  if (wasPresent !== day.present) {
    setWasPresent(day.present);
    setJustValidated(day.present);
  }
  const okDot = `${dot} bg-success text-white${justValidated ? " pop-in" : ""}`;
  // Fuera de su puesto habitual (o cubre otro departamento): el ✓ va en azul en vez de verde.
  const habitualExtras = (member.employee.defaultExtraDepartmentIds ?? []).filter((id) => id !== day.departmentId);
  const relocated = day.departmentId !== member.employee.defaultDepartmentId || !sameIds(day.extraDepartmentIds, habitualExtras);
  const okDotWork = relocated ? `${dot} bg-accent text-accent-fg${justValidated ? " pop-in" : ""}` : okDot;
  const pendingDotWork = relocated ? `${dot} bg-accent/15 text-accent` : `${dot} bg-success/15 text-success`;
  const press = useLongPress(onMove, onOpen);
  const habitual = employee.defaultDepartmentId ? departments.get(employee.defaultDepartmentId) : undefined;
  const moved = day.departmentId !== employee.defaultDepartmentId;
  // Departamentos de esta noche (principal + los que también cubre) menos el de la burbuja en la que está.
  const tonight = [day.departmentId, ...day.extraDepartmentIds]
    .filter((id): id is string => !!id && id !== groupId)
    .map((id) => departments.get(id))
    .filter((d): d is DepartmentLite => !!d);
  const covering = !!groupId && day.departmentId !== groupId && day.extraDepartmentIds.includes(groupId);
  const sections = day.segments.map((s) => segmentName(s, sectionNames));

  const name = employee.name;
  return (
    <div className="flex items-center">
      <button
        type="button"
        {...press}
        className="flex min-h-[33px] min-w-0 flex-1 select-none items-center gap-2 py-0.5 pl-3.5 pr-1 text-left [-webkit-touch-callout:none] active:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-tight">{employee.name}</span>
          {showStatus ? (
            <span className="block truncate text-[11px] leading-tight text-muted">
              {day.status.label}
              {day.reason ? ` · ${day.reason}` : ""}
            </span>
          ) : (
            (sections.length > 0 || tonight.length > 0 || moved) && (
              <span className="flex flex-wrap items-center gap-x-1.5 leading-tight">
                {tonight.map((d, i) => (
                  <span key={d.id} className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {covering && i === 0 ? `de ${d.name}` : groupId ? `+ ${d.name}` : d.name}
                  </span>
                ))}
                {sections.map((n, i) => (
                  <span key={i} className="text-[11px] text-muted">
                    {n}
                  </span>
                ))}
                {moved && habitual && !covering && <span className="text-[11px] text-warning">↪ de {habitual.name}</span>}
              </span>
            )
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
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
              <span className={okDot}>✓</span>
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
          {/* ⇄ cambiar de puesto (durante el día se organiza; por la noche solo se valida con ✓). */}
          {attendance.onMove && (
            <button type="button" onClick={attendance.onMove} aria-label={`Cambiar de puesto a ${name}`} className={hit}>
              <span className={cn(dot, relocated ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted")}>⇄</span>
            </button>
          )}
          {day.present ? (
            <button
              type="button"
              onClick={attendance.onUndo}
              aria-label={`${name} ha venido${relocated ? " (fuera de su puesto habitual)" : ""}. Toca para deshacer`}
              className={hit}
            >
              <span className={okDotWork}>✓</span>
            </button>
          ) : (
            <>
              <button type="button" onClick={attendance.onAbsent} aria-label={`${name} no ha venido`} className={hit}>
                <span className={`${dot} bg-danger/12 text-danger`}>✗</span>
              </button>
              <button
                type="button"
                onClick={attendance.onPresent}
                aria-label={`${name} ha venido${relocated ? " (fuera de su puesto habitual)" : ""}`}
                className={hit}
              >
                <span className={pendingDotWork}>✓</span>
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

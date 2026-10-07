"use client";

import Link from "next/link";
import { useState } from "react";
import { NoteList } from "@/components/notes/NoteList";
import type { NoteOptions } from "@/components/notes/NoteSheet";
import type { NoteView } from "@/lib/notes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TimeInput } from "@/components/ui/TimeInput";
import type { DepartmentLite, RosterMember } from "@/lib/schedule";
import type { ShiftTimes } from "@/lib/segments";
import { formatOvertime, proposeOvertime } from "@/lib/overtime";
import { AutoText } from "./AutoText";
import { SegmentEditor } from "./SegmentEditor";
import type { SectionLite, SegmentWithId, SheetOps } from "./types";

interface EmployeeSheetProps {
  open: boolean;
  onClose: () => void;
  member: RosterMember;
  departments: DepartmentLite[];
  sections: SectionLite[];
  shift: ShiftTimes;
  busy: boolean;
  error: string | null;
  ops: SheetOps;
  /** Notas de esta noche sobre la persona. */
  notes: NoteView[];
  noteOptions: NoteOptions;
  onAddNote: () => void;
  /** Abre la misma hoja que ✗ / ⇄ en ausentes (pregunta si ha avisado). */
  onChangeStatus: () => void;
  /** Abre el cierre de turno (las horas extra se apuntan allí). */
  onOvertime: () => void;
  /** Abre la misma hoja que ⇄ (cambiar de puesto). */
  onMove?: () => void;
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function EmployeeSheet({
  open,
  onClose,
  member,
  departments,
  sections,
  shift,
  busy,
  error,
  ops,
  notes,
  noteOptions,
  onAddNote,
  onChangeStatus,
  onOvertime,
  onMove,
}: EmployeeSheetProps) {
  const { employee, day } = member;
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const habitual = employee.defaultDepartmentId ? deptMap.get(employee.defaultDepartmentId) : undefined;
  const [showTimes, setShowTimes] = useState(!!(day.arrivedAt || day.leftAt));
  const extra = day.extraMinutes ?? 0;
  const suggestion = proposeOvertime(day.leftAt, shift);
  const segments = day.segments.filter((s): s is SegmentWithId => !!s.id);
  const activeDepartments = departments.filter((d) => d.active !== false || d.id === day.departmentId);

  return (
    <BottomSheet open={open} onClose={onClose} title={employee.name}>
      <div className="divide-y divide-line">
        {error && (
          <p role="alert" className="mb-2 rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
            {error}
          </p>
        )}

        <Block title="Hoy">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[16px] font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: day.status.color }} aria-hidden />
                {day.status.code === "WORK" ? (day.present ? "Ha venido" : "Trabaja") : day.status.label}
              </p>
              <p className="text-[13px] text-muted">
                Planning: {(day.planned ?? day.status).label}
                {day.planned ? " · no cuadra, queda como aviso" : ""}
              </p>
            </div>
            <button type="button" onClick={onChangeStatus} className="press min-h-11 shrink-0 rounded-control bg-surface-2 px-3 text-[15px] font-semibold text-accent">
              {day.isWorking ? "No ha venido" : "Cambiar"}
            </button>
          </div>
          {!day.isWorking && (
            <AutoText
              label="Motivo"
              value={day.reason ?? ""}
              onSave={ops.setReason}
              maxLength={200}
              placeholder="Ej. gripe, asuntos propios…"
            />
          )}
          {day.isWorking && (
            <div className="flex items-center gap-2">
              <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
                {[day.departmentId, ...day.extraDepartmentIds]
                  .map((id) => (id ? deptMap.get(id) : undefined))
                  .filter((d): d is DepartmentLite => !!d)
                  .map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                      {d.name}
                    </span>
                  ))}
                {!day.departmentId && day.extraDepartmentIds.length === 0 && <span className="text-muted">Sin departamento</span>}
                <span className="text-[13px] text-muted">{habitual ? `(habitual: ${habitual.name})` : ""}</span>
              </p>
              {onMove && (
                <button type="button" onClick={onMove} aria-label="Cambiar de puesto" className="press min-h-11 shrink-0 rounded-control bg-surface-2 px-3 text-[15px] font-semibold text-accent">
                  ⇄ Puesto
                </button>
              )}
            </div>
          )}
        </Block>

        {day.isWorking && (
          <>
            <Block title="Tareas" hint={`Turno ${shift.shiftStart}–${shift.shiftEnd}`}>
              <SegmentEditor
                segments={segments}
                sections={sections}
                departments={new Map(activeDepartments.map((d) => [d.id, d]))}
                shift={shift}
                busy={busy}
                onAdd={ops.addSegment}
                onUpdate={ops.updateSegment}
                onDelete={ops.deleteSegment}
              />
            </Block>

            {!showTimes ? (
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => setShowTimes(true)}
                  className="min-h-11 text-[15px] font-medium text-accent"
                >
                  + Llegó tarde o salió a otra hora
                </button>
              </div>
            ) : (
              <Block title="Horario real">
                <div className="grid grid-cols-2 gap-3">
                  <TimeInput
                    label="Llega a"
                    clearable
                    value={day.arrivedAt ?? ""}
                    onChange={(v) =>
                      ops.setTimes({ arrivedAt: v, leftAt: day.leftAt ?? "", timeReason: day.timeReason ?? "" })
                    }
                  />
                  <TimeInput
                    label="Sale a"
                    clearable
                    value={day.leftAt ?? ""}
                    onChange={(v) =>
                      ops.setTimes({ arrivedAt: day.arrivedAt ?? "", leftAt: v, timeReason: day.timeReason ?? "" })
                    }
                  />
                </div>
                {(day.arrivedAt || day.leftAt) && (
                  <AutoText
                    label="Motivo del cambio de horario"
                    value={day.timeReason ?? ""}
                    onSave={(v) =>
                      ops.setTimes({ arrivedAt: day.arrivedAt ?? "", leftAt: day.leftAt ?? "", timeReason: v })
                    }
                    maxLength={200}
                    placeholder="Ej. médico, se queda a cubrir…"
                  />
                )}
              </Block>
            )}

            <Block title="Horas extra">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-[15px]">
                  {extra > 0 ? <b>{formatOvertime(extra, true)}</b> : <span className="text-muted">Ninguna</span>}
                  {day.extraNote && <span className="text-muted"> — {day.extraNote}</span>}
                  {extra === 0 && suggestion !== null && <span className="text-accent"> · salió a las {day.leftAt}</span>}
                </p>
                <button type="button" onClick={onOvertime} className="press min-h-11 shrink-0 rounded-control bg-surface-2 px-3 text-[15px] font-semibold text-accent">
                  Cierre de turno
                </button>
              </div>
            </Block>
          </>
        )}

        <Block title="Notas de esta noche" hint={notes.length > 0 ? String(notes.length) : undefined}>
          <NoteList notes={notes} options={noteOptions} defaults={{ date: day.date, employeeId: employee.id }} showWho={false} />
          <button
            type="button"
            onClick={onAddNote}
            className="flex min-h-11 items-center justify-center gap-2 rounded-control bg-surface-2 text-[16px] font-medium text-accent"
          >
            + Nota o foto
          </button>
        </Block>

        <div className="py-2 text-center">
          <Link
            href={`/ajustes/empleados/${employee.id}`}
            className="inline-flex min-h-11 items-center px-3 text-[14px] text-muted underline-offset-2 active:underline"
          >
            Ver ficha
          </Link>
        </div>
      </div>
    </BottomSheet>
  );
}

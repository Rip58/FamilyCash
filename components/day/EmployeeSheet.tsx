"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NoteList } from "@/components/notes/NoteList";
import type { NoteOptions } from "@/components/notes/NoteSheet";
import type { NoteView } from "@/lib/notes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TimeInput } from "@/components/ui/TimeInput";
import { getAbsenceNotice } from "@/app/actions/absences";
import type { DepartmentLite, RosterMember, StatusTypeLite } from "@/lib/schedule";
import { toggleDepartment } from "@/lib/segments";
import type { ShiftTimes } from "@/lib/segments";
import { formatOvertime, proposeOvertime } from "@/lib/overtime";
import { AutoText } from "./AutoText";
import { DepartmentGrid } from "./DepartmentGrid";
import { NoticeToggle } from "./NoticeToggle";
import { StatusButtons } from "./StatusButtons";
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
  statusTypes: StatusTypeLite[];
  /** Falta (tocaba trabajar y no ha venido): ¿ha avisado? */
  onNotice: (notified: boolean | null, statusTypeId: string) => void;
  /** Abre el cierre de turno (las horas extra se apuntan allí). */
  onOvertime: () => void;
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
  statusTypes,
  onNotice,
  onOvertime,
}: EmployeeSheetProps) {
  const { employee, day } = member;
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const habitual = employee.defaultDepartmentId ? deptMap.get(employee.defaultDepartmentId) : undefined;
  const statusOptions = statusTypes.filter((s) => s.active !== false || s.id === day.status.id);
  // Falta: le tocaba trabajar y no ha venido. Se pregunta si avisó (queda en su historial).
  const missed = (day.planned ?? day.status).isWorking && !day.isWorking;
  const [notified, setNotified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!missed) return;
    let alive = true;
    getAbsenceNotice(employee.id, day.date).then((r) => alive && setNotified(r?.notified ?? null));
    return () => {
      alive = false;
    };
  }, [missed, employee.id, day.date]);
  const saveNotice = (v: boolean | null) => {
    setNotified(v);
    onNotice(v, day.status.id);
  };
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

        <Block title="Hoy" hint={`Planning: ${(day.planned ?? day.status).label}${day.planned ? " · no cuadra" : ""}`}>
          <StatusButtons statuses={statusOptions} value={day.status.id} onPick={(st) => ops.setStatus(st.id)} />
          {missed && <NoticeToggle value={notified} onChange={saveNotice} />}
          {!day.isWorking && (
            <AutoText
              label="Motivo"
              value={day.reason ?? ""}
              onSave={ops.setReason}
              maxLength={200}
              placeholder="Ej. gripe, asuntos propios…"
            />
          )}
        </Block>

        {day.isWorking && activeDepartments.length > 0 && (
          <Block title="Departamentos de hoy" hint={habitual ? `Habitual: ${habitual.name}` : "Sin habitual"}>
            <DepartmentGrid
              departments={activeDepartments}
              chosen={[...(day.departmentId ? [day.departmentId] : []), ...day.extraDepartmentIds]}
              habitualId={employee.defaultDepartmentId}
              onPickOne={(id) => ops.setDepartment(id === employee.defaultDepartmentId ? null : id, [])}
              onToggle={(id) => {
                const next = toggleDepartment(day.departmentId, day.extraDepartmentIds, id);
                ops.setDepartment(next.main === employee.defaultDepartmentId ? null : next.main, next.extras);
              }}
            />
          </Block>
        )}

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

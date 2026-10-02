"use client";

import Link from "next/link";
import { useState } from "react";
import { ReportCard } from "@/components/reports/ReportCard";
import type { ReportView } from "@/lib/reports";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/ui/Chip";
import { TimeInput } from "@/components/ui/TimeInput";
import type { DepartmentLite, RosterMember, StatusTypeLite } from "@/lib/schedule";
import type { ShiftTimes } from "@/lib/segments";
import { clampOvertime, formatOvertime, proposeOvertime } from "@/lib/overtime";
import { AutoText } from "./AutoText";
import { OvertimeStepper } from "./OvertimeStepper";
import { SegmentEditor } from "./SegmentEditor";
import { StatusButtons } from "./StatusButtons";
import type { SectionLite, SegmentWithId, SheetOps } from "./types";

interface EmployeeSheetProps {
  open: boolean;
  onClose: () => void;
  member: RosterMember;
  statusTypes: StatusTypeLite[];
  departments: DepartmentLite[];
  sections: SectionLite[];
  shift: ShiftTimes;
  busy: boolean;
  error: string | null;
  ops: SheetOps;
  /** Avisos de esta noche que mencionan al empleado. */
  reports: ReportView[];
  onNewReport: () => void;
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
  statusTypes,
  departments,
  sections,
  shift,
  busy,
  error,
  ops,
  reports,
  onNewReport,
}: EmployeeSheetProps) {
  const { employee, day } = member;
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const habitual = employee.defaultDepartmentId ? deptMap.get(employee.defaultDepartmentId) : undefined;
  const statusOptions = statusTypes.filter((s) => s.active !== false || s.id === day.status.id);
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

        <Block title="Qué pasa hoy">
          <p className="mb-2 text-[13px] text-muted">
            Planning (Semana): <b className="text-fg">{(day.planned ?? day.status).label}</b>
            {day.planned ? " · no cuadra, queda como aviso" : ""}. Esto no cambia la Semana.
          </p>
          <StatusButtons statuses={statusOptions} value={day.status.id} onPick={(s) => ops.setStatus(s.id)} />
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

        <Block title="Departamento de hoy" hint={habitual ? `Habitual: ${habitual.name}` : "Sin habitual"}>
          <div className="flex flex-wrap gap-2">
            {activeDepartments.map((d) => (
              <Chip
                key={d.id}
                selected={day.departmentId === d.id}
                color={d.color}
                onClick={() => ops.setDepartment(d.id === employee.defaultDepartmentId ? null : d.id)}
              >
                {d.name}
              </Chip>
            ))}
          </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <OvertimeStepper
                  label="Horas extra"
                  minutes={extra}
                  onChange={(m) => ops.setOvertime(m, day.extraNote ?? "")}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 60].map((n) => (
                  <Chip key={n} onClick={() => ops.setOvertime(clampOvertime(extra + n), day.extraNote ?? "")}>
                    {n === 60 ? "+1 h" : `+${n}`}
                  </Chip>
                ))}
                {extra > 0 && (
                  <Chip onClick={() => ops.setOvertime(0, day.extraNote ?? "")}>Quitar</Chip>
                )}
              </div>
              {suggestion !== null && extra === 0 && (
                <div className="flex items-center gap-3 rounded-control bg-accent/10 px-3 py-2">
                  <p className="min-w-0 flex-1 text-[14px]">
                    Salió a las {day.leftAt} → ¿apuntar {formatOvertime(suggestion)}?
                  </p>
                  <button
                    type="button"
                    onClick={() => ops.setOvertime(suggestion, day.extraNote ?? "")}
                    className="min-h-11 shrink-0 rounded-control bg-accent px-4 text-[15px] font-semibold text-accent-fg active:opacity-80"
                  >
                    Apuntar
                  </button>
                </div>
              )}
              {(extra > 0 || day.extraNote) && (
                <AutoText
                  label="Motivo de las horas extra"
                  value={day.extraNote ?? ""}
                  onSave={(v) => ops.setOvertime(extra, v)}
                  maxLength={200}
                  placeholder="Ej. descarga de camión, inventario…"
                />
              )}
            </Block>
          </>
        )}

        <Block title="Nota del día">
          <AutoText
            label="Sobre este empleado, hoy"
            value={day.note ?? ""}
            onSave={ops.setNote}
            multiline
            maxLength={500}
            placeholder="Escribe una nota…"
          />
        </Block>

        <Block title="Avisos" hint={reports.length > 0 ? String(reports.length) : undefined}>
          {reports.length > 0 && (
            <div className="flex flex-col gap-2">
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} readOnly />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onNewReport}
            className="flex min-h-11 items-center justify-center gap-2 rounded-control bg-surface-2 text-[16px] font-medium text-accent"
          >
            <span aria-hidden>📷</span> Aviso con foto
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

"use client";

import { type ReactNode, useEffect, useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportComposer } from "@/components/reports/ReportComposer";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { tint } from "@/components/ui/icons";
import {
  addSegment as addSegmentAction,
  deleteSegment as deleteSegmentAction,
  setDayNote as setDayNoteAction,
  setDepartment as setDepartmentAction,
  setNote as setNoteAction,
  setOvertime as setOvertimeAction,
  setAttendance as setAttendanceAction,
  setOvertimeBulk as setOvertimeBulkAction,
  setReason as setReasonAction,
  setStatus as setStatusAction,
  setTimes as setTimesAction,
  updateSegment as updateSegmentAction,
  type ActionResult,
} from "@/app/actions/day";
import { type DateStr, madridParts } from "@/lib/dates";
import { formatOvertime, totalOvertime } from "@/lib/overtime";
import type { ReportView } from "@/lib/report-format";
import { statusAbbr } from "@/lib/week";
import {
  type DayEntryLite,
  type DepartmentLite,
  type EmployeeLite,
  type RosterMember,
  type StatusTypeLite,
  getDayRoster,
} from "@/lib/schedule";
import { type EntryPatch, type ShiftTimes, applyEntryPatch } from "@/lib/segments";
import { AbsentSheet } from "./AbsentSheet";
import { DayNoteCard } from "./DayNoteCard";
import { EmployeeRow } from "./EmployeeRow";
import { EmployeeSheet } from "./EmployeeSheet";
import { MoveSheet } from "./MoveSheet";
import { OvertimeSheet, type OvertimeGroup } from "./OvertimeSheet";
import type { SectionLite, SheetOps } from "./types";

interface DayViewProps {
  date: DateStr;
  shift: ShiftTimes;
  employees: EmployeeLite[];
  departments: DepartmentLite[];
  statusTypes: StatusTypeLite[];
  sections: SectionLite[];
  entries: DayEntryLite[];
  dayNote: string | null;
  reports: ReportView[];
  /** La fecha mostrada es la noche operativa actual. */
  isToday?: boolean;
}

const subscribeNever = () => () => {};
// Lista sin departamentos (orden del Excel): se recuerda en este móvil.
const FLAT_KEY = "hoy:sinDepartamentos";
const currentMadridHour = () => madridParts(new Date()).hour;

interface OptimisticAction {
  employeeId: string;
  patch: EntryPatch;
}

export function DayView({ date, shift, employees, departments, statusTypes, sections, entries, dayNote, reports, isToday = false }: DayViewProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null);
  const [move, setMove] = useState<{ id: string; open: boolean; checkIn?: boolean } | null>(null);
  const [absentSheet, setAbsentSheet] = useState<{ id: string; open: boolean; change?: boolean } | null>(null);
  const [closeSheet, setCloseSheet] = useState<{ open: boolean; n: number }>({ open: false, n: 0 });
  const madridHour = useSyncExternalStore(subscribeNever, currentMadridHour, () => null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [flat, setFlat] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(FLAT_KEY) === "1") setFlat(true);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  const toggleFlat = () => {
    const next = !flat;
    setFlat(next);
    try {
      localStorage.setItem(FLAT_KEY, next ? "1" : "0");
    } catch {
      /* ignorar */
    }
  };
  const [composer, setComposer] = useState<{ open: boolean; employeeId: string | null }>({ open: false, employeeId: null });

  const [optEntries, applyOptimistic] = useOptimistic(entries, (cur: DayEntryLite[], a: OptimisticAction) => {
    const employee = employees.find((e) => e.id === a.employeeId);
    if (!employee) return cur;
    const existing = cur.find((e) => e.employeeId === a.employeeId);
    const next = applyEntryPatch(existing, employee, date, statusTypes, a.patch, shift.shiftStart);
    return existing ? cur.map((e) => (e === existing ? next : e)) : [...cur, next];
  });
  const [optNote, setOptNote] = useOptimistic(dayNote, (_cur: string | null, next: string) => next.trim() || null);

  const roster = useMemo(
    () => getDayRoster({ date, employees, entries: optEntries, departments, statusTypes }),
    [date, employees, optEntries, departments, statusTypes],
  );
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const sectionNames = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);
  const activeSections = useMemo(() => sections, [sections]);
  const composerEmployees = useMemo(
    () => employees.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name, "es")),
    [employees],
  );
  const reportedIds = useMemo(() => new Set(reports.flatMap((r) => (r.employeeId ? [r.employeeId] : []))), [reports]);
  const openComposer = (employeeId: string | null) => setComposer({ open: true, employeeId });
  const activeDepartments = useMemo(() => departments.filter((d) => d.active !== false), [departments]);

  const allMembers = useMemo(() => {
    const m = new Map<string, RosterMember>();
    for (const d of roster.departments) for (const x of [...d.present, ...d.absent]) m.set(x.employee.id, x);
    for (const x of roster.unassigned) m.set(x.employee.id, x);
    for (const g of roster.absentByStatus) for (const x of g.members) m.set(x.employee.id, x);
    return m;
  }, [roster]);

  const commit = (employeeId: string, patch: EntryPatch, call: () => Promise<ActionResult>) => {
    startTransition(async () => {
      applyOptimistic({ employeeId, patch });
      const r = await call();
      setError(r.ok ? null : r.error);
    });
  };

  const opsFor = (employeeId: string): SheetOps => {
    const base = { employeeId, date };
    return {
      setStatus: (statusTypeId, reason, present) =>
        commit(employeeId, { kind: "status", statusTypeId, reason, present }, () =>
          setStatusAction({ ...base, statusTypeId, reason, present }),
        ),
      setReason: (reason) =>
        commit(employeeId, { kind: "reason", reason }, () => setReasonAction({ ...base, reason: reason.trim() || null })),
      setDepartment: (departmentId, extraDepartmentIds = []) =>
        commit(employeeId, { kind: "department", departmentId, extraDepartmentIds }, () =>
          setDepartmentAction({ ...base, departmentId, extraDepartmentIds }),
        ),
      setTimes: (t) => {
        const arrivedAt = t.arrivedAt || null;
        const leftAt = t.leftAt || null;
        const timeReason = t.timeReason.trim() || null;
        commit(employeeId, { kind: "times", arrivedAt, leftAt, timeReason }, () =>
          setTimesAction({ ...base, arrivedAt, leftAt, timeReason }),
        );
      },
      setNote: (note) =>
        commit(employeeId, { kind: "note", note }, () => setNoteAction({ ...base, note: note.trim() || null })),
      setOvertime: (minutes, note) => {
        const extraNote = note.trim() || null;
        commit(employeeId, { kind: "overtime", extraMinutes: minutes || null, extraNote }, () =>
          setOvertimeAction({ ...base, extraMinutes: minutes, extraNote }),
        );
      },
      addSegment: (s) =>
        commit(
          employeeId,
          { kind: "segmentAdd", segment: { ...s, id: `tmp-${Date.now()}`, note: null, sortOrder: 0 } },
          () => addSegmentAction({ ...base, ...s }),
        ),
      updateSegment: (id, s) =>
        commit(employeeId, { kind: "segmentUpdate", segment: { ...s, id, note: null, sortOrder: 0 } }, () =>
          updateSegmentAction({ ...base, segmentId: id, ...s }),
        ),
      deleteSegment: (id) =>
        commit(employeeId, { kind: "segmentDelete", id }, () => deleteSegmentAction({ ...base, segmentId: id })),
    };
  };

  const saveDayNote = (text: string) => {
    startTransition(async () => {
      setOptNote(text);
      const r = await setDayNoteAction({ date, text });
      setError(r.ok ? null : r.error);
    });
  };

  const openSheet = (id: string) => {
    setError(null);
    setSheet({ id, open: true });
  };
  const openMove = (id: string) => setMove({ id, open: true });
  const setPresent = (employeeId: string, present: boolean) =>
    commit(employeeId, { kind: "attendance", present }, () => setAttendanceAction({ employeeId, date, present }));

  /** `groupId` = burbuja de departamento en la que se pinta (no repetir ese nombre en la fila). */
  const row = (m: RosterMember, groupId: string | null) => (
    <EmployeeRow
      key={m.employee.id}
      member={m}
      groupId={groupId}
      sectionNames={sectionNames}
      departments={deptMap}
      shift={shift}
      showStatus={!m.day.isWorking}
      hasReports={reportedIds.has(m.employee.id)}
      onOpen={() => openSheet(m.employee.id)}
      onMove={() => openMove(m.employee.id)}
      attendance={
        m.day.isWorking
          ? {
              onPresent: () => {
                setPresent(m.employee.id, true);
                if (activeDepartments.length > 0) setMove({ id: m.employee.id, open: true, checkIn: true });
              },
              onUndo: () => setPresent(m.employee.id, false),
              onAbsent: () => setAbsentSheet({ id: m.employee.id, open: true }),
            }
          : undefined
      }
      absence={
        m.day.isWorking
          ? undefined
          : {
              onConfirm: () => setPresent(m.employee.id, true),
              onUndo: () => setPresent(m.employee.id, false),
              onChange: () => setAbsentSheet({ id: m.employee.id, open: true, change: true }),
            }
      }
    />
  );

  const sheetMember = sheet ? allMembers.get(sheet.id) : undefined;
  const moveMember = move ? allMembers.get(move.id) : undefined;
  const absentMember = absentSheet ? allMembers.get(absentSheet.id) : undefined;
  const closeGroups = useMemo<OvertimeGroup[]>(() => {
    const groups: OvertimeGroup[] = roster.departments
      .filter((d) => d.present.length > 0)
      .map((d) => ({ id: d.department.id, name: d.department.name, color: d.department.color, members: d.present }));
    if (roster.unassigned.length > 0) {
      groups.push({ id: "none", name: "Sin departamento", color: null, members: roster.unassigned });
    }
    return groups;
  }, [roster]);
  const nightExtra = useMemo(
    () => totalOvertime(closeGroups.flatMap((g) => g.members.map((m) => m.day))),
    [closeGroups],
  );
  const closeHighlight = isToday && madridHour !== null && madridHour >= 5 && madridHour < 12;
  // Orden fijo (departamento habitual y orden de Ajustes) para que la fila no salte al asignar sitio.
  const deptOrder = new Map(departments.map((d) => [d.id, d.sortOrder]));
  const habitualOrder = (m: RosterMember) =>
    m.employee.defaultDepartmentId ? (deptOrder.get(m.employee.defaultDepartmentId) ?? 9999) : 9999;
  const byOrder = (a: RosterMember, b: RosterMember) =>
    habitualOrder(a) - habitualOrder(b) ||
    a.employee.sortOrder - b.employee.sortOrder ||
    a.employee.name.localeCompare(b.employee.name, "es");
  const expected = [...roster.departments.flatMap((d) => d.present), ...roster.unassigned];
  // Una burbuja por departamento (donde trabaja hoy) + "Sin departamento".
  const groups = [
    ...roster.departments
      .filter((d) => d.present.length > 0 || d.covering.length > 0 || d.isEmpty)
      // Los que se han quedado sin nadie, arriba (son los que hay que resolver).
      .sort((a, b) => Number(b.isEmpty) - Number(a.isEmpty))
      .map((d) => ({
        id: d.department.id,
        name: d.department.name,
        color: d.department.color as string | null,
        // Los que vienen de otro departamento a cubrir éste, al final.
        members: [...[...d.present].sort(byOrder), ...[...d.covering].sort(byOrder)],
        staffed: d.staffed,
        target: d.targetStaff,
        isEmpty: d.isEmpty,
        isUnder: d.isUnderStaffed,
      })),
    ...(roster.unassigned.length > 0
      ? [{ id: "none", name: "Sin departamento", color: null, members: [...roster.unassigned].sort(byOrder), staffed: roster.unassigned.length, target: 0, isEmpty: false, isUnder: false }]
      : []),
  ];
  const confirmed = expected.filter((m) => m.day.present).length;
  const everyone = [...expected, ...roster.absentByStatus.flatMap((g) => g.members)];
  const validated = everyone.filter((m) => m.day.present).length;
  const mismatches = [...expected, ...roster.absentByStatus.flatMap((g) => g.members)]
    .filter((m) => m.day.planned)
    .sort(byOrder);
  const absentGroups = roster.absentByStatus.filter((g) => g.members.length > 0);

  const absentMembers = absentGroups.flatMap((g) => g.members);
  // Orden del Excel (Semana → Ver sin departamentos); sin orden, al final por el orden habitual.
  const flatMembers = [...expected, ...absentMembers].sort(
    (a, b) => (a.employee.rotaOrder ?? 1e9) - (b.employee.rotaOrder ?? 1e9) || byOrder(a, b),
  );
  const allValidated = everyone.length > 0 && validated === everyone.length;

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center gap-1">
        {/* Contadores en una sola línea (si no caben, se deslizan de lado). */}
        <p className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap" aria-label="Resumen del día">
          {roster.countsByStatus.map(({ status, count }) => (
            <span
              key={status.id}
              title={status.label}
              aria-label={`${count} ${status.label.toLowerCase()}`}
              className="inline-flex h-7 shrink-0 items-center gap-[3px] rounded-full px-1.5 text-[12px] font-semibold tabular-nums"
              style={{ backgroundColor: tint(status.color, 18) }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} aria-hidden />
              {count}
              <span className="font-medium text-muted">{statusAbbr(status)}</span>
            </span>
          ))}
          {everyone.length > 0 && (
            <span
              aria-label={`Pasar lista: ${validated} de ${everyone.length} validados; ${confirmed} de ${expected.length} han venido`}
              className={cn(
                "inline-flex h-7 shrink-0 items-center rounded-full px-1.5 text-[12px] font-semibold tabular-nums",
                allValidated ? "bg-success/20 text-success" : "text-muted",
              )}
            >
              ✓ {validated}/{everyone.length}
            </span>
          )}
        </p>
        <ActionMenu
          label="Opciones del día"
          badge={closeHighlight || nightExtra > 0}
          items={[
            { icon: "note", label: "Nota del día", onSelect: () => setNoteOpen(true) },
            {
              icon: flat ? "group" : "list",
              label: flat ? "Agrupar por departamentos" : "Ver sin departamentos",
              onSelect: toggleFlat,
            },
            {
              icon: "clockMoon",
              label: "Cierre de turno",
              hint: nightExtra > 0 ? formatOvertime(nightExtra, true) : undefined,
              highlight: closeHighlight,
              onSelect: () => setCloseSheet((s) => ({ open: true, n: s.n + 1 })),
            },
          ]}
        />
      </div>

      {mismatches.length > 0 && (
        <section aria-label="No cuadra con el planning" className="rounded-card bg-warning/12 px-3.5 py-1.5">
          <h2 className="flex min-h-8 items-center gap-1.5 text-[14px] font-semibold">
            <span aria-hidden>⚠️</span> No cuadra con el planning · {mismatches.length}
          </h2>
          <ul className="divide-y divide-warning/25">
            {mismatches.map((m) => (
              <li key={m.employee.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openSheet(m.employee.id)}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left"
                >
                  <span className="truncate text-[15px] leading-tight">{m.employee.name}</span>
                  <span className="flex flex-wrap items-center gap-1 text-[12px] leading-tight">
                    <span className="text-muted">{m.day.planned!.label}</span>
                    <span aria-hidden>→</span>
                    <span className="font-semibold" style={{ color: m.day.status.color }}>
                      {m.day.status.code === "WORK" ? "Ha venido" : m.day.status.label}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => opsFor(m.employee.id).setStatus(m.day.planned!.id)}
                  aria-label={`Dejar a ${m.employee.name} como el planning`}
                  className="min-h-11 shrink-0 px-2 text-[13px] font-semibold text-accent"
                >
                  Como el planning
                </button>
              </li>
            ))}
          </ul>
          <p className="pb-1 text-[12px] leading-snug text-muted">Si el planning está mal, corrígelo en Semana.</p>
        </section>
      )}

      <DayNoteCard note={optNote} onSave={saveDayNote} open={noteOpen} onOpenChange={setNoteOpen} />

      {reports.length > 0 && (
        <section aria-label="Avisos" className="flex flex-col gap-2">
          <h2 className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted">Avisos · {reports.length}</h2>
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </section>
      )}

      {flat ? (
        flatMembers.length > 0 && (
          <Card flush aria-label="Todos (orden del Excel)">
            <div className="divide-y divide-line">{flatMembers.map((m) => row(m, null))}</div>
          </Card>
        )
      ) : (
        <>
          {groups.map((g) => {
            const came = g.members.filter((m) => m.day.present).length;
            return (
              <GroupCard
                key={g.id}
                name={g.name}
                color={g.color}
                danger={g.isEmpty}
                badges={
                  <>
                    {g.members.length > 0 && (
                      <span className={cn(came === g.members.length && "text-success")}>
                        ✓ {came}/{g.members.length}
                      </span>
                    )}
                    {g.target > 0 && (
                      <span className={cn(g.isEmpty ? "text-danger" : g.isUnder && "text-warning")}>
                        {g.staffed}/{g.target} plazas
                      </span>
                    )}
                  </>
                }
              >
                {g.isEmpty ? (
                  <p className="px-3.5 py-2 text-[14px] font-semibold text-danger">Sin personal</p>
                ) : (
                  g.members.map((m) => row(m, g.id))
                )}
              </GroupCard>
            );
          })}
          {absentGroups.map((g) => {
            const ok = g.members.filter((m) => m.day.present).length;
            return (
              <GroupCard
                key={g.status.id}
                name={g.status.label}
                color={g.status.color}
                badges={<span className={cn(ok === g.members.length && "text-success")}>✓ {ok}/{g.members.length}</span>}
              >
                {g.members.map((m) => row(m, null))}
              </GroupCard>
            );
          })}
        </>
      )}

      {sheet && sheetMember && (
        <EmployeeSheet
          key={sheet.id}
          open={sheet.open}
          onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))}
          member={sheetMember}
          statusTypes={statusTypes}
          departments={departments}
          sections={activeSections}
          shift={shift}
          busy={pending}
          error={error}
          ops={opsFor(sheet.id)}
          reports={reports.filter((r) => r.employeeId === sheet.id)}
          onNewReport={() => {
            setSheet((s) => (s ? { ...s, open: false } : s));
            openComposer(sheet.id);
          }}
        />
      )}

      {closeSheet.n > 0 && (
        <OvertimeSheet
          key={closeSheet.n}
          open={closeSheet.open}
          onClose={() => setCloseSheet((s) => ({ ...s, open: false }))}
          groups={closeGroups}
          shift={shift}
          onSave={async (items) => {
            const r = await setOvertimeBulkAction({ date, items });
            if (!r.ok) setError(r.error);
            return r;
          }}
        />
      )}

      {absentSheet && absentMember && (
        <AbsentSheet
          key={absentSheet.id}
          open={absentSheet.open}
          onClose={() => setAbsentSheet((s) => (s ? { ...s, open: false } : s))}
          title={absentSheet.change ? `${absentMember.employee.name} · no cuadra` : `${absentMember.employee.name} no ha venido`}
          note={
            <>
              Planning: <b>{(absentMember.day.planned ?? absentMember.day.status).label}</b>. La Semana no cambia: si no
              cuadra, queda como aviso.
            </>
          }
          current={absentSheet.change ? absentMember.day.status.id : null}
          statusTypes={statusTypes}
          onConfirm={(statusTypeId, reason) => opsFor(absentSheet.id).setStatus(statusTypeId, reason)}
          onCame={
            absentSheet.change
              ? () => {
                  const work = statusTypes.find((s) => s.code === "WORK");
                  if (!work) return;
                  opsFor(absentSheet.id).setStatus(work.id, null);
                  if (activeDepartments.length > 0) setMove({ id: absentSheet.id, open: true, checkIn: true });
                }
              : undefined
          }
        />
      )}

      {move && moveMember && (
        <MoveSheet
          open={move.open}
          onClose={() => setMove((m) => (m ? { ...m, open: false } : m))}
          name={moveMember.employee.name}
          title={move.checkIn ? `${moveMember.employee.name} ha venido · ¿Dónde trabaja hoy?` : undefined}
          departments={activeDepartments}
          currentId={moveMember.day.departmentId}
          extraIds={moveMember.day.extraDepartmentIds}
          habitualId={moveMember.employee.defaultDepartmentId}
          onPick={(id, extras) =>
            opsFor(move.id).setDepartment(id === moveMember.employee.defaultDepartmentId ? null : id, extras)
          }
        />
      )}

      <ReportComposer
        open={composer.open}
        onClose={() => setComposer((c) => ({ ...c, open: false }))}
        date={date}
        employees={composerEmployees}
        sections={sections.map((s) => ({ id: s.id, name: s.name }))}
        employeeId={composer.employeeId}
      />
    </div>
  );
}

/** Burbuja de departamento o de estado: cabecera pastel baja con barra de color. */
function GroupCard({
  name,
  color,
  badges,
  danger,
  children,
}: {
  name: string;
  color: string | null;
  badges: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Card flush tone={danger ? "danger" : "default"} aria-label={name}>
      <div
        className="flex min-h-7 items-center justify-between gap-2 border-l-4 px-3"
        style={{ backgroundColor: tint(color, 16), borderLeftColor: color ?? "#64748b" }}
      >
        <h2 className="min-w-0 truncate text-[13px] font-semibold">{name}</h2>
        <span className="flex shrink-0 items-center gap-2.5 text-[12px] font-semibold tabular-nums text-muted">{badges}</span>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

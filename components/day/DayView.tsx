"use client";

import { useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportComposer } from "@/components/reports/ReportComposer";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
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
import type { ReportView } from "@/lib/reports";
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
const currentMadridHour = () => madridParts(new Date()).hour;

interface OptimisticAction {
  employeeId: string;
  patch: EntryPatch;
}

export function DayView({ date, shift, employees, departments, statusTypes, sections, entries, dayNote, reports, isToday = false }: DayViewProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null);
  const [move, setMove] = useState<{ id: string; open: boolean } | null>(null);
  const [absentSheet, setAbsentSheet] = useState<{ id: string; open: boolean } | null>(null);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [closeSheet, setCloseSheet] = useState<{ open: boolean; n: number }>({ open: false, n: 0 });
  const madridHour = useSyncExternalStore(subscribeNever, currentMadridHour, () => null);
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
      setStatus: (statusTypeId, reason) =>
        commit(employeeId, { kind: "status", statusTypeId, reason }, () =>
          setStatusAction({ ...base, statusTypeId, reason }),
        ),
      setReason: (reason) =>
        commit(employeeId, { kind: "reason", reason }, () => setReasonAction({ ...base, reason: reason.trim() || null })),
      setDepartment: (departmentId) =>
        commit(employeeId, { kind: "department", departmentId }, () => setDepartmentAction({ ...base, departmentId })),
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

  const row = (m: RosterMember, showStatus = false) => (
    <EmployeeRow
      key={m.employee.id}
      member={m}
      sectionNames={sectionNames}
      departments={deptMap}
      shift={shift}
      showStatus={showStatus}
      hasReports={reportedIds.has(m.employee.id)}
      onOpen={() => openSheet(m.employee.id)}
      onMove={() => openMove(m.employee.id)}
      attendance={
        m.day.isWorking
          ? {
              onPresent: () => setPresent(m.employee.id, true),
              onUndo: () => setPresent(m.employee.id, false),
              onAbsent: () => setAbsentSheet({ id: m.employee.id, open: true }),
            }
          : undefined
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
  const absentTotal = roster.absentByStatus.reduce((n, g) => n + g.members.length, 0);
  const expected = [...roster.departments.flatMap((d) => d.present), ...roster.unassigned];
  const confirmed = expected.filter((m) => m.day.present).length;
  const absentCode = roster.absentByStatus.find((g) => g.status.code === "ABSENT")?.members.length ?? 0;

  return (
    <div className="flex flex-col gap-3 pb-6">
      {roster.countsByStatus.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted" aria-label="Resumen del día">
          {roster.countsByStatus.map(({ status, count }) => (
            <span key={status.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} aria-hidden />
              <span>
                <span className="font-semibold text-fg">{count}</span>{" "}
                {status.code === "WORK" ? "trabajan" : status.label.toLowerCase()}
              </span>
            </span>
          ))}
        </p>
      )}

      <button
        type="button"
        onClick={() => setCloseSheet((s) => ({ open: true, n: s.n + 1 }))}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-3 rounded-card px-4 text-left text-[16px] font-semibold active:opacity-80",
          closeHighlight ? "bg-accent text-accent-fg" : "bg-surface text-accent",
        )}
      >
        <span>Cierre de turno · Horas extra</span>
        {nightExtra > 0 && <span className="text-[14px] font-medium tabular-nums">{formatOvertime(nightExtra, true)}</span>}
      </button>

      {expected.length > 0 && (
        <p
          className={cn(
            "flex min-h-11 items-center justify-between gap-3 rounded-card px-4 text-[15px] font-medium",
            confirmed === expected.length ? "bg-success/15 text-fg" : "bg-surface",
          )}
          aria-label="Pasar lista"
        >
          <span>
            Pasar lista · <span className="tabular-nums font-semibold">{confirmed}/{expected.length}</span> han venido
          </span>
          {absentCode > 0 && <span className="text-[14px] text-danger">{absentCode} falta{absentCode === 1 ? "" : "n"}</span>}
        </p>
      )}

      <div className={cn(!optNote && "-mt-1")}>
        <DayNoteCard note={optNote} onSave={saveDayNote} />
      </div>

      {reports.length > 0 && (
        <section aria-label="Avisos" className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Avisos · {reports.length}
          </h2>
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </section>
      )}

      {expected.length > 0 && (
        <Card flush aria-label="Empleados">
          <div className="divide-y divide-line py-1">{expected.map((m) => row(m))}</div>
        </Card>
      )}

      {absentTotal > 0 && (
        <section className="rounded-card bg-surface">
          <button
            type="button"
            aria-expanded={absentOpen}
            onClick={() => setAbsentOpen((v) => !v)}
            className="flex min-h-12 w-full items-center justify-between px-4 text-left"
          >
            <span className="text-[16px] font-semibold">No vienen hoy · {absentTotal}</span>
            <span className={cn("text-muted transition-transform", absentOpen && "rotate-90")} aria-hidden>
              ›
            </span>
          </button>
          {absentOpen &&
            roster.absentByStatus.map((g) => (
              <div key={g.status.id} className="border-t border-line pb-1">
                <h3 className="flex items-center gap-2 px-4 pt-3 pb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.status.color }} aria-hidden />
                  {g.status.label} · {g.members.length}
                </h3>
                <div className="divide-y divide-line">
                  {g.members.map((m) => (
                    <EmployeeRow
                      key={m.employee.id}
                      member={m}
                      sectionNames={sectionNames}
                      departments={deptMap}
                      shift={shift}
                      onOpen={() => openSheet(m.employee.id)}
                      onMove={() => openMove(m.employee.id)}
                      hasReports={reportedIds.has(m.employee.id)}
                      showStatus
                    />
                  ))}
                </div>
              </div>
            ))}
        </section>
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
          name={absentMember.employee.name}
          planned={absentMember.day.status}
          statusTypes={statusTypes}
          onConfirm={(statusTypeId, reason) => opsFor(absentSheet.id).setStatus(statusTypeId, reason)}
        />
      )}

      {move && moveMember && (
        <MoveSheet
          open={move.open}
          onClose={() => setMove((m) => (m ? { ...m, open: false } : m))}
          name={moveMember.employee.name}
          departments={activeDepartments}
          currentId={moveMember.day.departmentId}
          habitualId={moveMember.employee.defaultDepartmentId}
          onPick={(id) => opsFor(move.id).setDepartment(id === moveMember.employee.defaultDepartmentId ? null : id)}
        />
      )}

      <button
        type="button"
        onClick={() => openComposer(null)}
        aria-label="Nuevo aviso con foto"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-[26px] text-accent-fg shadow-lg active:opacity-80"
        style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 16px)" }}
      >
        <span aria-hidden>📷</span>
      </button>

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

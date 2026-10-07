import Link from "next/link";
import { notFound } from "next/navigation";
import { DayReportView } from "@/components/report/DayReportView";
import { AddNoteButton } from "@/components/notes/NoteList";
import { ReportTabs } from "@/components/report/ReportTabs";
import { ShareButton } from "@/components/report/ShareButton";
import { Icon } from "@/components/ui/icons";
import { reportIconBtn } from "@/components/report/header-button";
import { buildShareModel } from "@/lib/report-share";
import { WeekSummaryView } from "@/components/report/WeekSummaryView";
import { WeekTasks } from "@/components/report/WeekTasks";
import {
  type DateStr,
  addDays,
  formatDayLong,
  formatWeekRange,
  isDateStr,
  isoWeekNumber,
  operationalToday,
  weekDays,
} from "@/lib/dates";
import { getNotes, getPendingTasksBefore } from "@/lib/note-queries";
import { noteLine } from "@/lib/notes";
import { getDepartments, getEmployees, getEntriesBetween, getSections, getSettings, getStatusTypes } from "@/lib/queries";
import { buildDayReport, buildWeekSummary, reportToText } from "@/lib/report";
import { getDayRoster, getWeekGrid } from "@/lib/schedule";

export const metadata = { title: "Informe" };
export const dynamic = "force-dynamic";

function NavButton({ href, label, children }: { href: string; label: string; children: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-[26px] leading-none active:opacity-60"
    >
      {children}
    </Link>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ date?: string[] }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ date: segs }, { v }] = await Promise.all([params, searchParams]);
  if (segs && (segs.length !== 1 || !isDateStr(segs[0]!))) notFound();

  const settings = await getSettings();
  const date: DateStr = segs?.[0] ?? operationalToday(new Date(), settings.dayRolloverHour);
  const view = v === "semana" ? "semana" : "dia";
  const q = view === "semana" ? "?v=semana" : "";
  const step = view === "semana" ? 7 : 1;

  const [employees, departments, statusTypes, sections] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getStatusTypes(),
    getSections(),
  ]);

  let body: React.ReactNode;
  let title: string;
  let subtitle: string;
  let share: React.ReactNode = null;
  let addNote: React.ReactNode = null;

  const options = {
    employees: employees
      .filter((e) => e.active)
      .map((e) => ({ id: e.id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    departments: departments.filter((d) => d.active !== false).map((d) => ({ id: d.id, name: d.name })),
    sections: sections.map((s) => ({ id: s.id, name: s.name })),
  };

  if (view === "dia") {
    const [entries, notes] = await Promise.all([getEntriesBetween(date, date), getNotes(date, date)]);
    const roster = getDayRoster({ date, employees, entries, departments, statusTypes });
    const report = buildDayReport({ roster, shift: settings, sections, departments, notes });
    title = formatDayLong(date);
    subtitle = `Turno ${settings.shiftStart}–${settings.shiftEnd} · ${report.presentCount} trabajan`;
    addNote = (
      <AddNoteButton defaults={{ date }} options={options} ariaLabel="Añadir nota" className={reportIconBtn}>
        <Icon name="note" className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </AddNoteButton>
    );
    body = <DayReportView report={report} options={options} />;
    if (!report.isEmpty) share = (
        <ShareButton text={reportToText(report)} model={buildShareModel(report)} fileName={`informe-noche-${date}.png`} />
      );
  } else {
    const days = weekDays(date);
    const [entries, weekNotes, olderTasks] = await Promise.all([
      getEntriesBetween(days[0]!, days[6]!),
      getNotes(days[0]!, days[6]!),
      getPendingTasksBefore(days[0]!),
    ]);
    const tasks = [...olderTasks, ...weekNotes.filter((n) => n.type === "TASK")];
    const notes = weekNotes
      .filter((n) => n.type !== "TASK")
      .map((n) => ({ date: n.date, name: null, text: noteLine(n) }));
    const grid = getWeekGrid({
      date,
      employees,
      entries,
      departments,
      statusTypes,
      daysOffPerWeek: settings.daysOffPerWeek,
    });
    const rosters = days.map((d) => getDayRoster({ date: d, employees, entries, departments, statusTypes }));
    const summary = buildWeekSummary({ date, grid, statusTypes, rosters, shift: settings, notes });
    title = `Semana ${isoWeekNumber(days[0]!)}`;
    subtitle = formatWeekRange(date);
    body = (
      <>
        <WeekTasks tasks={tasks} weekStart={days[0]!} />
        <WeekSummaryView summary={summary} />
      </>
    );
  }

  return (
    <div className="space-y-3 pb-4 pt-4">
      <h1 className="sr-only">Informe</h1>
      <div className="flex items-center gap-2">
        <NavButton href={`/informe/${addDays(date, -step)}${q}`} label={view === "semana" ? "Semana anterior" : "Día anterior"}>
          ‹
        </NavButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[19px] font-bold tracking-tight">{title}</div>
          <div className="truncate text-[13px] text-muted">{subtitle}</div>
        </div>
        <NavButton href={`/informe/${addDays(date, step)}${q}`} label={view === "semana" ? "Semana siguiente" : "Día siguiente"}>
          ›
        </NavButton>
      </div>
      {/* Una sola línea: Día/Semana + nota + historial de empleado + compartir. */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ReportTabs date={date} view={view} />
        </div>
        {addNote}
        <Link href="/informe/empleado" aria-label="Historial y notas" className={reportIconBtn}>
          <Icon name="search" className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </Link>
        {share}
      </div>
      {body}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { DayReportView } from "@/components/report/DayReportView";
import { ReportAdd } from "@/components/report/ReportAdd";
import { ReportTabs } from "@/components/report/ReportTabs";
import { ShareButton } from "@/components/report/ShareButton";
import { WeekSummaryView } from "@/components/report/WeekSummaryView";
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
import {
  getDayNote,
  getDayNotesBetween,
  getDepartments,
  getEmployees,
  getEntriesBetween,
  getNightNotes,
  getSections,
  getSettings,
  getStatusTypes,
} from "@/lib/queries";
import { getReportsForDate } from "@/lib/report-queries";
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

  if (view === "dia") {
    const [entries, dayNote, reports, nightNotes] = await Promise.all([
      getEntriesBetween(date, date),
      getDayNote(date),
      getReportsForDate(date),
      getNightNotes(date, date),
    ]);
    const roster = getDayRoster({ date, employees, entries, departments, statusTypes });
    const report = buildDayReport({ roster, dayNote, shift: settings, sections, departments, reports, nightNotes });
    title = formatDayLong(date);
    subtitle = `Turno ${settings.shiftStart}–${settings.shiftEnd} · ${report.presentCount} trabajan`;
    const people = employees
      .filter((e) => e.active)
      .map((e) => ({ id: e.id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    body = (
      <>
        <ReportAdd date={date} employees={people} />
        <DayReportView report={report} />
      </>
    );
    if (!report.isEmpty) share = <ShareButton text={reportToText(report)} title={`Informe de noche · ${report.title}`} />;
  } else {
    const days = weekDays(date);
    const [entries, nightNotes, dayNotes] = await Promise.all([
      getEntriesBetween(days[0]!, days[6]!),
      getNightNotes(days[0]!, days[6]!),
      getDayNotesBetween(days[0]!, days[6]!),
    ]);
    const nameById = new Map(employees.map((e) => [e.id, e.name]));
    const notes = [
      ...dayNotes.map((n) => ({ date: n.date, name: null, text: n.text })),
      ...nightNotes.map((n) => ({ date: n.date, name: n.name, text: n.text })),
      ...entries
        .filter((e) => e.note?.trim())
        .map((e) => ({ date: e.date, name: nameById.get(e.employeeId) ?? null, text: e.note!.trim() })),
    ];
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
    body = <WeekSummaryView summary={summary} />;
  }

  return (
    <div className="space-y-3 pb-4 pt-4">
      <h1 className="sr-only">Informe</h1>
      <div className="flex items-center gap-2">
        <NavButton href={`/informe/${addDays(date, -step)}${q}`} label={view === "semana" ? "Semana anterior" : "Día anterior"}>
          ‹
        </NavButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[22px] font-bold tracking-tight">{title}</div>
          <div className="truncate text-[13px] text-muted">{subtitle}</div>
        </div>
        <NavButton href={`/informe/${addDays(date, step)}${q}`} label={view === "semana" ? "Semana siguiente" : "Día siguiente"}>
          ›
        </NavButton>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ReportTabs date={date} view={view} />
        </div>
        {share}
      </div>
      {body}
      <div className="text-center">
        <Link href="/avisos" className="inline-flex min-h-11 items-center px-4 text-[15px] font-medium text-accent">
          Ver todos los avisos
        </Link>
      </div>
    </div>
  );
}

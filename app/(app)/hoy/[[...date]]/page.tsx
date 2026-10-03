import Link from "next/link";
import { notFound } from "next/navigation";
import { DayView } from "@/components/day/DayView";
import { cn } from "@/components/ui/cn";
import { addDays, formatDayLong, isDateStr, operationalToday } from "@/lib/dates";
import {
  getDayNote,
  getDepartments,
  getEmployees,
  getEntriesBetween,
  getSections,
  getSettings,
  getStatusTypes,
} from "@/lib/queries";
import { getReportsForDate } from "@/lib/report-queries";

export const metadata = { title: "Hoy" };
export const dynamic = "force-dynamic";

const navBtn =
  "flex min-h-11 min-w-11 items-center justify-center rounded-full text-[28px] leading-none text-accent active:bg-surface-2";

export default async function Page({ params }: { params: Promise<{ date?: string[] }> }) {
  const { date: segs } = await params;
  if (segs && (segs.length !== 1 || !isDateStr(segs[0]!))) notFound();

  const settings = await getSettings();
  const today = operationalToday(new Date(), settings.dayRolloverHour);
  const date = segs ? segs[0]! : today;
  const isToday = date === today;

  const [employees, departments, statusTypes, sections, entries, dayNote, reports] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getStatusTypes(),
    getSections(),
    getEntriesBetween(date, date),
    getDayNote(date),
    getReportsForDate(date),
  ]);

  const title = `${formatDayLong(date)} · ${settings.shiftStart}–${settings.shiftEnd}`;

  return (
    <div className="pt-2">
      <header className="mb-2 flex items-center gap-1">
        <Link href={`/hoy/${addDays(date, -1)}`} aria-label="Día anterior" className={navBtn}>
          ‹
        </Link>
        <div className="min-w-0 flex-1 text-center">
          {isToday ? (
            <h1 className="truncate text-[17px] font-semibold">{title}</h1>
          ) : (
            <Link
              href="/hoy"
              aria-label="Volver a hoy"
              className="flex min-h-11 flex-col items-center justify-center"
            >
              <h1 className="truncate text-[17px] font-semibold">{title}</h1>
              <span className={cn("text-[12px] font-medium text-accent")}>Volver a hoy</span>
            </Link>
          )}
        </div>
        <Link href={`/hoy/${addDays(date, 1)}`} aria-label="Día siguiente" className={navBtn}>
          ›
        </Link>
      </header>

      <DayView
        key={date}
        isToday={isToday}
        date={date}
        shift={{ shiftStart: settings.shiftStart, shiftEnd: settings.shiftEnd }}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          defaultDepartmentId: e.defaultDepartmentId,
          sortOrder: e.sortOrder,
          rotaOrder: e.rotaOrder,
          fixedDaysOff: e.fixedDaysOff,
          active: e.active,
          notes: e.notes,
        }))}
        departments={departments}
        statusTypes={statusTypes}
        sections={sections
          .filter((s) => s.active)
          .map((s) => ({ id: s.id, name: s.name, departmentId: s.departmentId }))}
        entries={entries}
        dayNote={dayNote}
        reports={reports}
      />
    </div>
  );
}

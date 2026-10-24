import { DayView } from "@/components/day/DayView";
import { ShareButton } from "@/components/report/ShareButton";
import { GuestPinForm } from "@/components/day/GuestPinForm";
import { getLoggedAbsences } from "@/lib/absence-log";
import { addDays, formatDayLong, formatDayShort } from "@/lib/dates";
import { db } from "@/lib/db";
import { GUEST_UNTIL, guestNight } from "@/lib/guest";
import { guestNightNow } from "@/lib/guest-server";
import { getGroupCovers } from "@/lib/group-covers";
import { getNotes } from "@/lib/note-queries";
import { getPendingDelays } from "@/lib/overtime-queries";
import { buildDayReport } from "@/lib/report";
import { dayShareProps } from "@/lib/report-share-props";
import { getDayRoster } from "@/lib/schedule";
import { getDepartments, getEmployees, getEntriesBetween, getSections, getSettings, getStatusTypes } from "@/lib/queries";
import { isOwner } from "@/lib/session";

export const metadata = { title: "Turno de esta noche", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Hoy para el compañero (/turno + PIN de 4 dígitos): SOLO la noche en curso, editable hasta las 09:30 del día
 * siguiente. Sin navegación a otras noches ni pantallas; cada acción vuelve a comprobarlo en el servidor.
 */
export default async function Page() {
  const night = (await guestNightNow()) ?? ((await isOwner()) ? guestNight(new Date()) : null);
  if (!night) return <GuestPinForm />;

  const [settings, employees, departments, statusTypes, sections, entries, notes, pendingDelays, groupCovers, loggedAbsences] =
    await Promise.all([
      getSettings(),
      getEmployees(),
      getDepartments(),
      getStatusTypes(),
      getSections(),
      getEntriesBetween(addDays(night, -7), addDays(night, 7)),
      getNotes(night, night),
      getPendingDelays(night),
      getGroupCovers(night, night),
      getLoggedAbsences(db, night, night),
    ]);

  // El mismo informe que comparte el dueño desde Informe (solo de esta noche).
  const roster = getDayRoster({ date: night, employees, entries, departments, statusTypes, groupCovers, loggedAbsences });
  const report = buildDayReport({ roster, shift: settings, sections, departments, notes });

  return (
    <div className="pt-2">
      <header className="relative mb-2 px-[52px] text-center">
        <h1 className="text-[17px] font-semibold">
          {formatDayLong(night)} · {settings.shiftStart}–{settings.shiftEnd}
        </h1>
        <p className="text-[12px] text-muted">
          Puedes apuntar hasta el {formatDayShort(addDays(night, 1)).toLowerCase()} a las {GUEST_UNTIL}
        </p>
        {!report.isEmpty && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <ShareButton {...dayShareProps(report, night)} />
          </div>
        )}
      </header>
      <DayView
        key={night}
        guest
        isToday
        date={night}
        shift={{ shiftStart: settings.shiftStart, shiftEnd: settings.shiftEnd }}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          defaultDepartmentId: e.defaultDepartmentId,
          defaultExtraDepartmentIds: e.defaultExtraDepartmentIds,
          sortOrder: e.sortOrder,
          rotaOrder: e.rotaOrder,
          fixedDaysOff: e.fixedDaysOff,
          active: e.active,
          // Las observaciones de la ficha son privadas: no se envían al compañero.
          notes: null,
        }))}
        departments={departments}
        statusTypes={statusTypes}
        sections={sections.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, departmentId: s.departmentId }))}
        // De los días de alrededor (para las fiestas pegadas a vacaciones) solo hace falta el estado.
        entries={entries.map((e) =>
          e.date === night
            ? e
            : { ...e, reason: null, arrivedAt: null, leftAt: null, timeReason: null, extraMinutes: null, extraNote: null, segments: [] },
        )}
        notes={notes}
        pendingDelays={pendingDelays}
        groupDepartmentIds={groupCovers.map((g) => g.departmentId)}
        loggedAbsences={loggedAbsences}
      />
    </div>
  );
}

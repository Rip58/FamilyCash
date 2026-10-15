import { DayView } from "@/components/day/DayView";
import { getLoggedAbsences } from "@/lib/absence-log";
import { addDays, formatDayLong, formatDayShort } from "@/lib/dates";
import { db } from "@/lib/db";
import { GUEST_UNTIL, guestNight } from "@/lib/guest";
import { guestNightNow } from "@/lib/guest-server";
import { getGroupCovers } from "@/lib/group-covers";
import { getNotes } from "@/lib/note-queries";
import { getPendingDelays } from "@/lib/overtime-queries";
import { getDepartments, getEmployees, getEntriesBetween, getSections, getSettings, getStatusTypes } from "@/lib/queries";
import { isOwner } from "@/lib/session";

export const metadata = { title: "Turno de esta noche", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Hoy para el compañero (enlace sin contraseña, /t/<código>): SOLO la noche en curso, editable hasta las 09:30 del
 * día siguiente. Sin navegación a otras noches ni pantallas; cada acción vuelve a comprobarlo en el servidor.
 */
export default async function Page() {
  const night = (await guestNightNow()) ?? ((await isOwner()) ? guestNight(new Date()) : null);
  if (!night) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-[20px] font-bold">Enlace no válido</h1>
        <p className="text-[15px] text-muted">Abre de nuevo el enlace que te pasaron. Si no funciona, pide el enlace nuevo.</p>
      </div>
    );
  }

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

  return (
    <div className="pt-2">
      <header className="mb-2 text-center">
        <h1 className="text-[17px] font-semibold">
          {formatDayLong(night)} · {settings.shiftStart}–{settings.shiftEnd}
        </h1>
        <p className="text-[12px] text-muted">
          Puedes apuntar hasta el {formatDayShort(addDays(night, 1)).toLowerCase()} a las {GUEST_UNTIL}
        </p>
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

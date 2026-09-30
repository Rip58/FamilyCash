import Link from "next/link";
import { type DateStr, formatDayShort } from "@/lib/dates";
import type { DayRoster } from "@/lib/schedule";
import { shortNames } from "@/lib/week";
import { cn } from "@/components/ui/cn";

function NoteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Tiene nota del día"
    >
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** Vista Días: 7 tarjetas verticales, una por noche. Componente de servidor. */
export function DaysView({
  rosters,
  notes,
  today,
}: {
  rosters: DayRoster[];
  notes: DateStr[];
  today: DateStr;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rosters.map((r) => {
        const isToday = r.date === today;
        const hasNote = notes.includes(r.date);
        const depts = r.departments.filter((d) => d.present.length + d.absent.length > 0);
        return (
          <li key={r.date}>
            <Link
              href={`/hoy/${r.date}`}
              className={cn(
                "block min-h-11 rounded-card bg-surface px-4 py-3 active:opacity-70",
                isToday && "ring-2 ring-accent",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[17px] font-semibold",
                      isToday && "rounded-full bg-accent px-2.5 py-0.5 text-accent-fg",
                    )}
                  >
                    {formatDayShort(r.date)}
                  </span>
                  {isToday && <span className="text-[12px] font-medium text-accent">Hoy</span>}
                  {hasNote && (
                    <span className="text-muted">
                      <NoteIcon />
                    </span>
                  )}
                </span>
                <span className="text-[15px] font-medium">{r.presentCount} trabajan</span>
              </div>

              {depts.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-label="Departamentos">
                  {depts.map((d) => {
                    const state = d.isEmpty ? "vacío" : d.isUnderStaffed ? "por debajo de plazas" : "completo";
                    const color = d.isEmpty
                      ? "var(--danger)"
                      : d.isUnderStaffed
                        ? "var(--warning)"
                        : d.department.color;
                    return (
                      <li
                        key={d.department.id}
                        className="flex items-center gap-1 text-[12px] text-muted"
                        title={`${d.department.name}: ${state}`}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className={cn(d.isEmpty && "font-semibold text-danger")}>
                          {d.present.length}
                          {d.targetStaff > 0 ? `/${d.targetStaff}` : ""}
                        </span>
                        <span className="sr-only">
                          {d.department.name}, {state}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mt-2 text-[13px] leading-snug text-muted">
                {r.absentByStatus.length === 0
                  ? "Todos trabajan"
                  : r.absentByStatus.map((g, i) => {
                      const names = shortNames(g.members.map((m) => m.employee.name));
                      return (
                        <span key={g.status.id}>
                          {i > 0 && " · "}
                          <span className="font-semibold" style={{ color: "var(--fg)" }}>
                            {g.status.label}:
                          </span>{" "}
                          {names.join(", ")}
                        </span>
                      );
                    })}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

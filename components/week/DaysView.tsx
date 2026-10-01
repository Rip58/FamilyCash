import Link from "next/link";
import { type DateStr, formatDayLong, formatDayShort } from "@/lib/dates";
import type { DayRoster } from "@/lib/schedule";
import { daySummary } from "@/lib/week";
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

const LEVEL = {
  ok: { stripe: "var(--success)", pill: "bg-success/15 text-success" },
  warn: { stripe: "var(--warning)", pill: "bg-warning/20 text-warning" },
  bad: { stripe: "var(--danger)", pill: "bg-danger/15 text-danger" },
} as const;

/**
 * Vista Días: 7 tarjetas, una por noche. De un vistazo: cuántos vienen, si algún departamento
 * se queda corto (semáforo) y quién falta por qué motivo. Componente de servidor.
 */
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
    <ul className="flex flex-col gap-2.5">
      {rosters.map((r) => {
        const isToday = r.date === today;
        const hasNote = notes.includes(r.date);
        const s = daySummary(r);
        const total = s.present + s.off.length + s.away.reduce((n, g) => n + g.names.length, 0);
        const level = LEVEL[s.level];
        const verdict = s.level === "ok" ? "✓ Completo" : s.missing > 0 ? `⚠ Faltan ${s.missing}` : "⚠ Revisar";
        return (
          <li key={r.date}>
            <Link
              href={`/hoy/${r.date}`}
              aria-label={`${formatDayLong(r.date)}: ${s.present} vienen, ${verdict.replace(/^[✓⚠] /, "")}`}
              className={cn(
                "relative block overflow-hidden rounded-card bg-surface py-3 pl-5 pr-4 active:opacity-70",
                isToday && "ring-2 ring-accent",
              )}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: level.stripe }} />

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="text-[17px] font-semibold">{formatDayShort(r.date)}</span>
                  {isToday && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-accent-fg">Hoy</span>
                  )}
                  {hasNote && (
                    <span className="text-muted">
                      <NoteIcon />
                    </span>
                  )}
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-[13px] font-semibold", level.pill)}>{verdict}</span>
              </div>

              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[28px] font-bold leading-none tabular-nums">{s.present}</span>
                <span className="text-[15px] font-medium">vienen</span>
                <span className="text-[14px] text-muted">de {total}</span>
              </p>

              {s.issues.length > 0 && (
                <ul className="mt-2 flex flex-col gap-0.5" aria-label="Departamentos cortos">
                  {s.issues.map((i) => (
                    <li
                      key={i.name}
                      className={cn("text-[14px] font-medium", i.present === 0 ? "text-danger" : "text-warning")}
                    >
                      {i.name}: {i.present === 0 ? "nadie" : `${i.present} de ${i.target}`}
                    </li>
                  ))}
                </ul>
              )}

              {s.away.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="No vienen">
                  {s.away.map((g) => (
                    <li
                      key={g.id}
                      className="rounded-[8px] border px-2 py-1 text-[13px] leading-tight"
                      style={{ borderColor: `${g.color}66`, backgroundColor: `${g.color}14` }}
                    >
                      <span className="font-semibold">
                        {g.label} {g.names.length}
                      </span>
                      <span className="text-muted"> · {g.names.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              )}

              {s.off.length > 0 && (
                <p className="mt-2 text-[13px] leading-snug text-muted">
                  <span className="font-medium">Libran {s.off.length}:</span> {s.off.join(", ")}
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

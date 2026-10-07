import { NoteList } from "@/components/notes/NoteList";
import type { NoteOptions } from "@/components/notes/NoteSheet";
import { Card } from "@/components/ui";
import { formatOvertime } from "@/lib/overtime";
import { formatDuration, type DayReport } from "@/lib/report";
import { buildShareModel } from "@/lib/report-share";

/** `options`: para editar las notas de la noche (tocar una nota). */
export function DayReportView({ report, options }: { report: DayReport; options: NoteOptions }) {
  // Misma agrupación que la imagen que se comparte: fiesta, vacaciones/bajas y faltas (en rojo), con comas.
  const share = buildShareModel(report);
  const hasPeopleIncidents =
    report.lateArrivals.length > 0 || report.leaveDeviations.length > 0 || report.absences.some((g) => g.members.length > 0);
  if (report.isEmpty) {
    return (
      <Card>
        <p className="py-6 text-center text-muted">No hay datos registrados para esta noche.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {report.notes.length > 0 && (
        <Card title={`Notas de la noche · ${report.notes.length}`}>
          <NoteList notes={report.notes} options={options} defaults={{ date: report.date }} />
        </Card>
      )}

      {/* Solo personas (como la imagen compartida): los departamentos sin nadie no salen. */}
      <Card title="Incidencias" tone={share.missing.length > 0 ? "danger" : "default"}>
        {!hasPeopleIncidents ? (
          <p className="text-[15px] text-muted">Sin incidencias esta noche.</p>
        ) : (
          <div className="space-y-4 text-[15px]">
            {report.lateArrivals.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-muted">Llegadas tarde</h3>
                <ul className="mt-1 space-y-1">
                  {report.lateArrivals.map((l) => (
                    <li key={l.name}>
                      <b>{l.name}</b> · {l.arrivedAt} (+{formatDuration(l.minutes)})
                      {l.reason && <span className="text-muted"> — {l.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.leaveDeviations.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-muted">Salidas</h3>
                <ul className="mt-1 space-y-1">
                  {report.leaveDeviations.map((d) => (
                    <li key={d.name}>
                      <b>{d.name}</b> ·{" "}
                      {d.kind === "stayed"
                        ? `se queda ${formatDuration(d.minutes)} más`
                        : `se va ${formatDuration(d.minutes)} antes`}{" "}
                      ({d.leftAt})
                      {d.reason && <span className="text-muted"> — {d.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {share.off.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-accent">Fiesta · {share.off.length}</h3>
                <p>{share.off.join(", ")}</p>
              </div>
            )}
            {share.away.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-[#8944ab] dark:text-[#c58ae6]">Vacaciones y bajas · {share.counts.away}</h3>
                {share.away.map((g) => (
                  <p key={g.label}>
                    <b>{g.label}:</b> {g.members.map((m) => (m.reason ? `${m.name} (${m.reason})` : m.name)).join(", ")}
                  </p>
                ))}
              </div>
            )}
            {share.missing.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-danger">Faltan · {share.missing.length}</h3>
                <p className="font-semibold text-danger">
                  {share.missing.map((m) => (m.reason ? `${m.name} (${m.reason})` : m.name)).join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {report.overtime.items.length > 0 && (
        <Card
          title="Horas extra"
          action={
            <span className="text-[15px] font-semibold tabular-nums" data-testid="report-overtime-total">
              Total {formatOvertime(report.overtime.totalMinutes)}
            </span>
          }
        >
          <ul className="space-y-1.5 text-[15px]">
            {report.overtime.items.map((o) => (
              <li key={o.name} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <b>{o.name}</b>
                  {o.note && <span className="text-muted"> — {o.note}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {o.minutes > 0 ? formatOvertime(o.minutes, true) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}


    </div>
  );
}

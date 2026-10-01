import { ReportCard } from "@/components/reports/ReportCard";
import { Card, Tag } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatOvertime } from "@/lib/overtime";
import { formatDuration, noteWho, type DayReport } from "@/lib/report";
import { DeleteNoteButton, TaskCheck } from "./ReportAdd";

export function DayReportView({ report }: { report: DayReport }) {
  if (report.isEmpty) {
    return (
      <Card>
        <p className="py-6 text-center text-muted">No hay datos registrados para esta noche.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {(report.note || report.nightNotes.length > 0 || report.employeeNotes.length > 0) && (
        <Card title="Notas de la noche">
          <ul className="divide-y divide-line text-[15px]">
            {report.note && (
              <li className="py-2">
                <span className="text-[13px] font-semibold text-muted">General</span>
                <p className="whitespace-pre-wrap">{report.note}</p>
              </li>
            )}
            {report.nightNotes.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-1 py-2", n.isTask && "-mx-2 rounded-control bg-warning/10 px-2")}>
                {n.isTask && <TaskCheck id={n.id} done={!!n.done} label={n.text} />}
                <div className="min-w-0 flex-1 pt-0.5">
                  <span className="text-[13px] font-semibold text-muted">
                    {n.isTask && <span className="mr-1 rounded bg-warning/30 px-1 text-[11px] uppercase text-fg">Tarea</span>}
                    {noteWho(n)}
                  </span>
                  <p className={cn("whitespace-pre-wrap", n.isTask && n.done && "text-muted line-through")}>{n.text}</p>
                </div>
                <DeleteNoteButton id={n.id} />
              </li>
            ))}
            {report.employeeNotes.map((n) => (
              <li key={n.employeeId} className="py-2">
                <span className="text-[13px] font-semibold text-muted">{n.name}</span>
                <p className="whitespace-pre-wrap">{n.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Incidencias" tone={report.emptyDepartments.length > 0 ? "danger" : "default"}>
        {!report.hasIncidents ? (
          <p className="text-[15px] text-muted">Sin incidencias esta noche.</p>
        ) : (
          <div className="space-y-4 text-[15px]">
            {report.emptyDepartments.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-danger">Sin personal</h3>
                <p>{report.emptyDepartments.join(", ")}</p>
              </div>
            )}
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
            {report.absences.map((g) => (
              <div key={g.statusId}>
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                  <Tag color={g.color}>{g.label}</Tag> {g.members.length}
                </h3>
                <ul className="mt-1 space-y-1">
                  {g.members.map((m) => (
                    <li key={m.name}>
                      <b>{m.name}</b>
                      {m.reason && <span className="text-muted"> — {m.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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

      {report.reports.length > 0 && (
        <section aria-label="Avisos con foto" className="space-y-2">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Avisos con foto · {report.reports.length}
          </h2>
          {report.reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </section>
      )}

    </div>
  );
}

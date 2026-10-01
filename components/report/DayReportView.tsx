import { ReportCard } from "@/components/reports/ReportCard";
import { Card, Tag } from "@/components/ui";
import { formatOvertime } from "@/lib/overtime";
import { formatDuration, type DayReport, type ReportMember } from "@/lib/report";
import { Timeline, segmentColor } from "./Timeline";

function MemberBlock({ m, report, fallbackDept }: { m: ReportMember; report: DayReport; fallbackDept: string }) {
  const { shift } = report;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[16px] font-semibold">{m.name}</span>
        {m.movedFrom && (
          <span className="text-[13px] text-muted">
            {m.movedFrom} → {m.departmentName}
          </span>
        )}
      </div>
      {m.segments.length > 0 ? (
        <div className="mt-2 space-y-2">
          <Timeline segments={m.segments} length={shift.length} breakFrom={shift.breakFrom} breakTo={shift.breakTo} />
          <p className="text-[14px] leading-snug">
            {m.segments.map((s, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted"> → </span>}
                <span className="whitespace-nowrap">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: segmentColor(s.colorIndex) }}
                  />
                  {s.start}–{s.end} {s.label}
                </span>
              </span>
            ))}
          </p>
        </div>
      ) : (
        <p className="mt-0.5 text-[14px] text-muted">Turno completo{(m.departmentName ?? fallbackDept) && ` en ${m.departmentName ?? fallbackDept}`}</p>
      )}
      {(m.arrivedAt || m.leftAt) && (
        <p className="mt-1 text-[13px] text-muted">
          {m.arrivedAt && <>Llega {m.arrivedAt}</>}
          {m.arrivedAt && m.leftAt && " · "}
          {m.leftAt && <>Sale {m.leftAt}</>}
          {m.timeReason && ` (${m.timeReason})`}
        </p>
      )}
    </li>
  );
}

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
      {report.note && (
        <Card title="Nota del día">
          <p className="whitespace-pre-wrap text-[15px]">{report.note}</p>
        </Card>
      )}

      {report.employeeNotes.length > 0 && (
        <Card title="Notas de empleados">
          <ul className="space-y-2 text-[15px]">
            {report.employeeNotes.map((n) => (
              <li key={n.employeeId}>
                <b>{n.name}</b>
                <p className="whitespace-pre-wrap text-fg">{n.note}</p>
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

      {report.departments.map((d) => (
        <Card
          key={d.id}
          title={
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
            </span>
          }
          action={
            <span className="text-[13px] text-muted">
              {d.presentCount}
              {d.targetStaff > 0 ? `/${d.targetStaff}` : ""}
            </span>
          }
        >
          <ul className="divide-y divide-line">
            {d.members.map((m) => (
              <MemberBlock key={m.employeeId} m={m} report={report} fallbackDept={d.name} />
            ))}
          </ul>
        </Card>
      ))}
      {report.unassigned.length > 0 && (
        <Card title="Sin departamento">
          <ul className="divide-y divide-line">
            {report.unassigned.map((m) => (
              <MemberBlock key={m.employeeId} m={m} report={report} fallbackDept="" />
            ))}
          </ul>
        </Card>
      )}
      <p className="px-1 text-center text-[12px] text-muted">
        Barra: turno {report.shift.start}–{report.shift.end}; zona rayada = descanso {report.shift.breakStart}–
        {report.shift.breakEnd}.
      </p>
    </div>
  );
}

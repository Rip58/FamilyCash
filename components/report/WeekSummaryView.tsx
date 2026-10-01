import Link from "next/link";
import { Card, Tag } from "@/components/ui";
import { formatOvertime } from "@/lib/overtime";
import type { WeekSummary } from "@/lib/report";

export function WeekSummaryView({ summary }: { summary: WeekSummary }) {
  if (summary.isEmpty) {
    return (
      <Card>
        <p className="py-6 text-center text-muted">
          Sin ausencias, llegadas tarde, horas extra ni departamentos vacíos esta semana.
        </p>
      </Card>
    );
  }
  const columns = summary.byType.map((t) => t.status);
  return (
    <div className="space-y-3">
      {summary.notes.length > 0 && (
        <Card title="Notas de la semana">
          <div className="space-y-3">
            {summary.notes.map((d) => (
              <div key={d.date}>
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{d.label}</h3>
                <ul className="mt-1 space-y-1 text-[15px]">
                  {d.items.map((n, i) => (
                    <li key={i} className="whitespace-pre-wrap">
                      <b>{n.name ?? "General"}:</b> {n.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Ausencias por tipo">
        <ul className="space-y-2">
          {summary.byType.length === 0 && <li className="text-muted">Nadie ha faltado.</li>}
          {summary.byType.map((t) => (
            <li key={t.status.id} className="flex min-h-8 items-center justify-between">
              <Tag color={t.status.color}>{t.status.label}</Tag>
              <span className="text-[17px] font-semibold tabular-nums">{t.count}</span>
            </li>
          ))}
          <li className="flex min-h-8 items-center justify-between border-t border-line pt-2">
            <span className="text-[14px] text-muted">Llegadas tarde</span>
            <span className="text-[17px] font-semibold tabular-nums">{summary.totalLate}</span>
          </li>
          <li className="flex min-h-8 items-center justify-between">
            <span className="text-[14px] text-muted">Horas extra de la semana</span>
            <span className="text-[17px] font-semibold tabular-nums" data-testid="week-overtime-total">
              {summary.totalExtraMinutes > 0 ? formatOvertime(summary.totalExtraMinutes) : "0"}
            </span>
          </li>
        </ul>
      </Card>

      <Card title="Por empleado" flush>
        {summary.byEmployee.length === 0 ? (
          <p className="p-4 pt-0 text-muted">Sin incidencias por empleado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="sticky left-0 bg-surface px-4 py-2 font-medium">Empleado</th>
                  {columns.map((s) => (
                    <th key={s.id} className="px-2 py-2 text-center font-medium">
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">Tarde</th>
                  <th className="px-3 py-2 text-center font-medium">Extra</th>
                </tr>
              </thead>
              <tbody>
                {summary.byEmployee.map((e) => (
                  <tr key={e.employeeId} className="border-t border-line">
                    <td className="sticky left-0 bg-surface px-4 py-2.5 font-medium">{e.name}</td>
                    {columns.map((s) => (
                      <td key={s.id} className="px-2 py-2.5 text-center tabular-nums">
                        {e.counts[s.id] ?? <span className="text-muted">·</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {e.lateArrivals || <span className="text-muted">·</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center tabular-nums">
                      {e.extraMinutes > 0 ? formatOvertime(e.extraMinutes, true) : <span className="text-muted">·</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Departamentos vacíos" tone={summary.emptyDays.length > 0 ? "danger" : "default"}>
        {summary.emptyDays.length === 0 ? (
          <p className="text-muted">Ningún día se queda un departamento sin personal.</p>
        ) : (
          <ul className="divide-y divide-line">
            {summary.emptyDays.map((d) => (
              <li key={d.date}>
                <Link href={`/informe/${d.date}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className="font-medium">{d.label}</span>
                  <span className="text-right text-[14px] text-danger">{d.departments.join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

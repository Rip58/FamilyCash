import { notFound } from "next/navigation";
import { DataTab } from "@/components/employee/DataTab";
import { FileTabs } from "@/components/employee/FileTabs";
import { HistoryTab } from "@/components/employee/HistoryTab";
import { RequestsTab } from "@/components/employee/RequestsTab";
import { BackHeader } from "@/components/settings/kit";
import { Tag } from "@/components/ui/Chip";
import { db } from "@/lib/db";
import { WEEKDAY_LETTERS, formatDayLong, operationalToday } from "@/lib/dates";
import { isFileTab } from "@/lib/employee-file";
import { loadNotes, loadRequests } from "@/lib/employee-file-queries";
import { getDepartments, getEntriesBetween, getSettings, getStatusTypes } from "@/lib/queries";
import { listReportsForEmployee } from "@/lib/report-queries";
import { getEffectiveDay } from "@/lib/schedule";

export const metadata = { title: "Ficha del empleado" };
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee) notFound();
  const tabParam = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const tab = isFileTab(tabParam) ? tabParam : "datos";

  const settings = await getSettings();
  const today = operationalToday(new Date(), settings.dayRolloverHour);
  const [departments, statusTypes, todayEntries, requests] = await Promise.all([
    getDepartments(),
    getStatusTypes(),
    getEntriesBetween(today, today),
    loadRequests({ employeeId: id }),
  ]);
  const entryCounts: [number, number] =
    tab === "datos"
      ? await Promise.all([db.dayEntry.count({ where: { employeeId: id } }), db.employeeNote.count({ where: { employeeId: id } })]).then(([a, b]): [number, number] => [a, b])
      : [0, 0];
  const [historyNotes, historyReports] =
    tab === "historial" ? await Promise.all([loadNotes(id), listReportsForEmployee(id)]) : [[], []];
  const entry = todayEntries.find((e) => e.employeeId === id) ?? null;
  const day = getEffectiveDay(employee, today, entry, statusTypes);
  const dept = departments.find((d) => d.id === employee.defaultDepartmentId) ?? null;
  const pending = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div>
      <BackHeader title={employee.name} href="/ajustes/empleados" backLabel="Volver a Empleados" />

      <section aria-label="Resumen" className="mb-4 rounded-card bg-surface px-4 py-3">
        {employee.alias && <p className="text-[14px] text-muted">Alias: {employee.alias}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {dept ? <Tag color={dept.color}>{dept.name}</Tag> : <span className="text-[14px] text-muted">Sin departamento</span>}
          {!employee.active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">Inactivo</span>}
          <span className="text-[14px] text-muted">
            {employee.fixedDaysOff.length
              ? `Libra: ${employee.fixedDaysOff.map((d) => WEEKDAY_LETTERS[d]).join(" ")}`
              : "Sin días fijos"}
          </span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px]" data-testid="today-status">
          <span className="text-muted">Hoy ({formatDayLong(today)}):</span>
          <Tag color={day.status.color}>{day.status.label}</Tag>
        </p>
      </section>

      <div className="mb-4">
        <FileTabs tab={tab} pending={pending} />
      </div>

      {tab === "datos" && (
        <DataTab
          employee={{
            id: employee.id,
            name: employee.name,
            alias: employee.alias,
            defaultDepartmentId: employee.defaultDepartmentId,
            fixedDaysOff: employee.fixedDaysOff,
            active: employee.active,
            notes: employee.notes,
            entryCount: entryCounts[0] + entryCounts[1] + requests.length,
          }}
          departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color, active: d.active ?? true }))}
        />
      )}
      {tab === "historial" && (
        <HistoryTab employeeId={id} notes={historyNotes} reports={historyReports} />
      )}
      {tab === "peticiones" && <RequestsTab employeeId={id} requests={requests} />}
    </div>
  );
}

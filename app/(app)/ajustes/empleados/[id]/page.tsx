import { notFound } from "next/navigation";
import { DataTab } from "@/components/employee/DataTab";
import { FileTabs } from "@/components/employee/FileTabs";
import { isFileTab } from "@/lib/file-tabs";
import { FileHistory } from "@/components/employee/FileHistory";
import { BackHeader } from "@/components/settings/kit";
import { Tag } from "@/components/ui/Chip";
import { db } from "@/lib/db";
import { WEEKDAY_LETTERS, formatDayLong, formatStamp, fromDbDate, operationalToday } from "@/lib/dates";
import { getDepartments, getEmployees, getEntriesBetween, getSections, getSettings, getStatusTypes } from "@/lib/queries";
import { loadEmployeeHistory } from "@/lib/employee-history-queries";
import { getEffectiveDay } from "@/lib/schedule";
import { headers } from "next/headers";
import { VacationPinCard } from "@/components/employee/VacationPinCard";
import { ensureVacationPins, getVacationCampaign } from "@/lib/vacation-queries";
import { VACATION_PAGE_READY, countedDays, needsSignature, parseSignedRanges, vacationInvite } from "@/lib/vacations";

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
  const [departments, statusTypes, todayEntries, employees, sections] = await Promise.all([
    getDepartments(),
    getStatusTypes(),
    getEntriesBetween(today, today),
    getEmployees(),
    getSections(),
  ]);
  const entryCount =
    tab === "datos"
      ? (await Promise.all([db.dayEntry.count({ where: { employeeId: id } }), db.nightNote.count({ where: { employeeId: id } })])).reduce((a, b) => a + b, 0)
      : 0;
  const historyItems = tab === "historial" ? await loadEmployeeHistory(id) : [];
  const noteOptions = {
    employees: employees
      .filter((e) => e.active || e.id === id)
      .map((e) => ({ id: e.id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    departments: departments.filter((d) => d.active !== false).map((d) => ({ id: d.id, name: d.name })),
    sections: sections.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name })),
  };
  const entry = todayEntries.find((e) => e.employeeId === id) ?? null;
  const day = getEffectiveDay(employee, today, entry, statusTypes);
  const dept = departments.find((d) => d.id === employee.defaultDepartmentId) ?? null;
  // Vacaciones: PIN fijo (se crea la primera vez) y el mensaje con el enlace cuando la página esté lista.
  const campaign = tab === "datos" && employee.active ? await getVacationCampaign() : null;
  const vacationPin = campaign ? ((await ensureVacationPins([id])).get(id) ?? null) : null;
  let invite: string | null = null;
  if (campaign && vacationPin && VACATION_PAGE_READY) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    invite = vacationInvite(employee.name, `${proto}://${host}/vacaciones`, vacationPin, campaign);
  }
  let vacationStatus: string | null = null;
  let pendingSignature = false;
  let signed: { at: string; ranges: { start: string; end: string }[]; signature: string }[] = [];
  if (campaign) {
    const [periods, submissions] = await Promise.all([
      db.vacationPeriod.findMany({ where: { employeeId: id, year: campaign.year } }),
      db.vacationSubmission.findMany({ where: { employeeId: id, year: campaign.year }, orderBy: { signedAt: "desc" } }),
    ]);
    const stored = periods.map((p) => ({ start: fromDbDate(p.start), end: fromDbDate(p.end), status: p.status }));
    const live = stored.filter((p) => p.status !== "CANCEL");
    if (stored.length) {
      const waiting = stored.filter((p) => p.status === "SENT" || p.status === "REVIEW" || p.status === "CANCEL").length;
      vacationStatus = `${countedDays(live)} de ${campaign.workDays} días · ${live.length} ${live.length === 1 ? "periodo" : "periodos"}${waiting ? ` · ${waiting} por revisar` : ""}`;
    }
    signed = submissions.map((x) => ({ at: formatStamp(x.signedAt), ranges: parseSignedRanges(x.periods), signature: x.signature }));
    pendingSignature = needsSignature(stored, submissions[0] ? parseSignedRanges(submissions[0].periods) : null);
  }

  return (
    <div>
      <BackHeader title={employee.name} href="/ajustes/empleados" backLabel="Volver a Empleados" preferBack />

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
        <FileTabs tab={tab} />
      </div>

      {tab === "datos" && campaign && vacationPin && <VacationPinCard employeeId={id} workDays={campaign.workDays} year={campaign.year} pin={vacationPin} invite={invite} status={vacationStatus} pendingSignature={pendingSignature} signed={signed} />}
      {tab === "datos" && (
        <DataTab
          employee={{
            id: employee.id,
            name: employee.name,
            alias: employee.alias,
            defaultDepartmentId: employee.defaultDepartmentId,
            defaultExtraDepartmentIds: employee.defaultExtraDepartmentIds ?? [],
            fixedDaysOff: employee.fixedDaysOff,
            active: employee.active,
            notes: employee.notes,
            entryCount,
          }}
          departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color, active: d.active ?? true }))}
        />
      )}
      {tab === "historial" && (
        <FileHistory
          employeeId={id}
          name={employee.name}
          items={historyItems}
          today={today}
          noteOptions={noteOptions}
          currentYear={new Date().getFullYear()}
        />
      )}
    </div>
  );
}

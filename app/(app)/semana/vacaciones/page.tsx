import { notFound } from "next/navigation";
import { VacationOverview } from "@/components/vacations/VacationOverview";
import { fromDbDate, isDateStr, madridToday, weekStart } from "@/lib/dates";
import { db } from "@/lib/db";
import { getDepartments, getEmployees } from "@/lib/queries";
import { getVacationCampaign, getVacationWeeks } from "@/lib/vacation-queries";
import { groupWeekRules, needsSignature, parseSignedRanges, vacationConflicts, vacationWeekGrid, yearWeeks } from "@/lib/vacations";
import { compactNames } from "@/lib/week";

export const metadata = { title: "Vacaciones" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  const campaign = await getVacationCampaign();
  if (!campaign) notFound();
  const weeks = yearWeeks(campaign.year);
  const wanted = weekStart(semana && isDateStr(semana) ? semana : madridToday());
  // Fuera del año de la campaña: su primera (o última) semana.
  const monday = wanted < weeks[0]! ? weeks[0]! : wanted > weeks.at(-1)! ? weeks.at(-1)! : wanted;

  const [employees, departments, rules, periods, signed] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getVacationWeeks(campaign.year),
    db.vacationPeriod.findMany({ where: { year: campaign.year } }),
    db.vacationSubmission.findMany({ where: { year: campaign.year }, distinct: ["employeeId"], select: { employeeId: true } }),
  ]);
  const lastSigned = await db.vacationSubmission.findMany({
    where: { year: campaign.year },
    orderBy: { signedAt: "desc" },
    distinct: ["employeeId"],
    select: { employeeId: true, periods: true },
  });
  const unreadRows = await db.vacationMessage.groupBy({
    by: ["employeeId"],
    where: { year: campaign.year, fromOwner: false, seen: false },
    _count: { _all: true },
  });
  const active = employees.filter((e) => e.active);
  const short = compactNames(active);
  const rule = rules.find((w) => w.weekStart === monday) ?? null;
  // La regla puede ser de varias semanas seguidas: el ⋯ las cambia todas juntas.
  const ruleRange = groupWeekRules(rules).find((r) => r.from <= monday && monday <= r.to) ?? null;
  const grid = vacationWeekGrid({
    monday,
    employees: active.map((e, i) => ({ id: e.id, name: e.name, alias: short[i], departmentId: e.defaultDepartmentId })),
    departments: departments
      .filter((d) => d.active !== false)
      .map((d) => ({ id: d.id, name: d.name, color: d.color ?? null, secondary: !!d.secondary })),
    periods: periods.map((p) => ({ employeeId: p.employeeId, start: fromDbDate(p.start), end: fromDbDate(p.end), status: p.status })),
    campaign,
    week: rule,
  });
  const activeIds = new Set(active.map((e) => e.id));
  const gridEmployees = active.map((e) => ({ id: e.id, name: e.name, departmentId: e.defaultDepartmentId }));
  const gridDepartments = departments
    .filter((d) => d.active !== false)
    .map((d) => ({ id: d.id, name: d.name, color: d.color ?? null, secondary: !!d.secondary }));
  const allPeriods = periods.map((p) => ({ id: p.id, employeeId: p.employeeId, start: fromDbDate(p.start), end: fromDbDate(p.end), status: p.status }));
  const conflicts = vacationConflicts({ year: campaign.year, employees: gridEmployees, departments: gridDepartments, periods: allPeriods, campaign, weeks: rules });
  const inConflict = new Set(conflicts.flatMap((c) => c.periodIds));
  const names = Object.fromEntries(active.map((e, i) => [e.id, short[i]!]));
  return (
    <VacationOverview
      key={monday}
      year={campaign.year}
      monday={monday}
      prev={weeks[weeks.indexOf(monday) - 1] ?? null}
      next={weeks[weeks.indexOf(monday) + 1] ?? null}
      grid={grid}
      rule={rule}
      ruleRange={ruleRange}
      sent={signed.filter((s) => activeIds.has(s.employeeId)).length}
      total={active.length}
      conflicts={conflicts.map((c) => ({ ...c, names: c.employeeIds.map((id) => names[id] ?? "—") }))}
      conflictPeriodIds={[...inConflict]}
      unread={Object.fromEntries(unreadRows.map((r) => [r.employeeId, r._count._all]))}
      cleanSentIds={allPeriods.filter((p) => p.status === "SENT" && activeIds.has(p.employeeId) && !inConflict.has(p.id)).map((p) => p.id)}
      okCount={allPeriods.filter((p) => p.status === "OK" && activeIds.has(p.employeeId)).length}
      toSign={active.filter((e) => {
        const last = lastSigned.find((x) => x.employeeId === e.id);
        return needsSignature(allPeriods.filter((p) => p.employeeId === e.id), last ? parseSignedRanges(last.periods) : null);
      }).length}
      cancelRequests={allPeriods.filter((p) => p.status === "CANCEL" && activeIds.has(p.employeeId)).length}
      workDays={campaign.workDays}
    />
  );
}

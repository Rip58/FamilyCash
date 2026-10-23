import { VacationPinForm } from "@/components/vacations/VacationPinForm";
import { VacationPlanner } from "@/components/vacations/VacationPlanner";
import { formatStamp, fromDbDate, madridToday } from "@/lib/dates";
import { db } from "@/lib/db";
import { getVacationCampaign, getVacationWeeks } from "@/lib/vacation-queries";
import { currentVacationEmployee } from "@/lib/vacation-server";

export const metadata = { title: "Vacaciones" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [employee, campaign] = await Promise.all([currentVacationEmployee(), getVacationCampaign()]);
  if (!campaign) {
    return <p className="py-24 text-center text-[16px] text-muted">Todavía no se pueden pedir vacaciones.</p>;
  }
  if (!employee) return <VacationPinForm year={campaign.year} deadline={campaign.deadline} />;

  const [weeks, periods, last, messages] = await Promise.all([
    getVacationWeeks(campaign.year),
    db.vacationPeriod.findMany({ where: { employeeId: employee.id, year: campaign.year }, orderBy: { start: "asc" } }),
    db.vacationSubmission.findFirst({ where: { employeeId: employee.id, year: campaign.year }, orderBy: { signedAt: "desc" }, select: { signedAt: true } }),
    db.vacationMessage.findMany({ where: { employeeId: employee.id, year: campaign.year }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <VacationPlanner
      name={employee.name}
      year={campaign.year}
      workDays={campaign.workDays}
      deadline={campaign.deadline}
      editable={campaign.open && madridToday() <= campaign.deadline}
      // Solo lo que el empleado puede ver: las semanas bloqueadas y su motivo (nada de los demás ni de los máximos).
      blocked={weeks.filter((w) => w.blocked).map((w) => ({ weekStart: w.weekStart, reason: w.reason }))}
      periods={periods.map((p) => ({ start: fromDbDate(p.start), end: fromDbDate(p.end), status: p.status }))}
      signedAt={last ? formatStamp(last.signedAt) : null}
      messages={messages.map((m) => ({ id: m.id, fromOwner: m.fromOwner, text: m.text, at: formatStamp(m.createdAt) }))}
      unseen={messages.filter((m) => m.fromOwner && !m.seen).length}
    />
  );
}

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { VacationSettings } from "@/components/settings/VacationSettings";
import { getDepartments, getEmployees } from "@/lib/queries";
import { ensureVacationPins, getVacationCampaign, getVacationWeeks } from "@/lib/vacation-queries";
import { VACATION_PAGE_READY, vacationInvite } from "@/lib/vacations";

export const metadata = { title: "Vacaciones" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [campaign, weeks, departments, employees] = await Promise.all([
    getVacationCampaign(),
    getVacationWeeks(),
    getDepartments(),
    getEmployees(),
  ]);
  if (!campaign) notFound();
  const active = employees.filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pins = await ensureVacationPins(active.map((e) => e.id));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/vacaciones`;
  return (
    <VacationSettings
      campaign={campaign}
      weeks={weeks}
      departments={departments
        .filter((d) => d.active !== false)
        .map((d) => ({ id: d.id, name: d.name, color: d.color ?? null, secondary: !!d.secondary }))}
      pins={active.map((e) => {
        const pin = pins.get(e.id) ?? "—";
        return { id: e.id, name: e.name, pin, invite: VACATION_PAGE_READY && pins.has(e.id) ? vacationInvite(e.name, url, pin, campaign) : null };
      })}
      pageReady={VACATION_PAGE_READY}
    />
  );
}

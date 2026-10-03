import { WeekImport } from "@/components/week/WeekImport";
import { aiProviderLabel, isAiProvider } from "@/lib/ai-import-format";
import { providerConfigured, providerModel } from "@/lib/ai-providers";
import { addDays, isDateStr, operationalToday, weekDays, weekStart } from "@/lib/dates";
import { getEmployees, getEntriesBetween, getSettings, getStatusTypes } from "@/lib/queries";
import { getEffectiveDay } from "@/lib/schedule";
import { compactNames } from "@/lib/week";

export const metadata = { title: "Cargar semana desde imagen" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  const [settings, allEmployees, statusTypes] = await Promise.all([getSettings(), getEmployees(), getStatusTypes()]);
  const provider = isAiProvider(settings.aiProvider) ? settings.aiProvider : "claude";
  // Sin semana indicada: la que viene (lo normal es cargar el planning con antelación).
  const week =
    semana && isDateStr(semana)
      ? weekStart(semana)
      : addDays(weekStart(operationalToday(new Date(), settings.dayRolloverHour)), 7);
  const days = weekDays(week);
  const entries = await getEntriesBetween(days[0]!, days[6]!);
  const byKey = new Map(entries.map((e) => [`${e.employeeId}|${e.date}`, e]));
  const employees = allEmployees.filter((e) => e.active);
  const short = compactNames(employees);
  return (
    <WeekImport
      key={week}
      weekStart={week}
      daysOffPerWeek={settings.daysOffPerWeek}
      provider={{ id: provider, label: aiProviderLabel(provider), model: providerModel(provider), configured: providerConfigured(provider) }}
      employees={employees.map((e, i) => ({
        id: e.id,
        name: e.name,
        short: short[i]!,
        // Planning actual de la semana (lo que se va a sustituir), para marcar lo que cambia.
        current: days.map((d) => {
          const day = getEffectiveDay(e, d, byKey.get(`${e.id}|${d}`), statusTypes);
          return (day.planned ?? day.status).id;
        }),
      }))}
      statuses={statusTypes
        .filter((s) => s.active !== false)
        .map((s) => ({ id: s.id, code: s.code, label: s.label, color: s.color, isWorking: s.isWorking, active: true, sortOrder: s.sortOrder }))}
    />
  );
}

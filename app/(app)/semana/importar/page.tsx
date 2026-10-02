import { WeekImport } from "@/components/week/WeekImport";
import { isAiProvider } from "@/lib/ai-import-format";
import { providerConfigured, providerModel } from "@/lib/ai-providers";
import { addDays, isDateStr, operationalToday, weekStart } from "@/lib/dates";
import { getEmployees, getSettings, getStatusTypes } from "@/lib/queries";

export const metadata = { title: "Cargar semana desde imagen" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  const [settings, employees, statusTypes] = await Promise.all([getSettings(), getEmployees(), getStatusTypes()]);
  const provider = isAiProvider(settings.aiProvider) ? settings.aiProvider : "claude";
  // Sin semana indicada: la que viene (lo normal es cargar el planning con antelación).
  const week =
    semana && isDateStr(semana)
      ? weekStart(semana)
      : addDays(weekStart(operationalToday(new Date(), settings.dayRolloverHour)), 7);
  return (
    <WeekImport
      key={week}
      weekStart={week}
      provider={{ id: provider, label: provider === "claude" ? "Claude" : "ChatGPT", model: providerModel(provider), configured: providerConfigured(provider) }}
      employees={employees.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name }))}
      statuses={statusTypes
        .filter((s) => s.active !== false)
        .map((s) => ({ id: s.id, code: s.code, label: s.label, color: s.color }))}
    />
  );
}

import { DataExport } from "@/components/settings/DataExport";
import { operationalToday } from "@/lib/dates";
import { getSettings } from "@/lib/queries";

export const metadata = { title: "Datos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dayRolloverHour } = await getSettings();
  return <DataExport today={operationalToday(new Date(), dayRolloverHour)} />;
}

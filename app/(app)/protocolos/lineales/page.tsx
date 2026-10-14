import { PlanogramBoard } from "@/components/protocols/PlanogramBoard";
import { operationalToday } from "@/lib/dates";
import { getLocations, getPlanograms } from "@/lib/planogram-queries";
import { getSettings } from "@/lib/queries";

export const metadata = { title: "Lineales" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const [planograms, locations, settings, { nuevo }] = await Promise.all([getPlanograms(), getLocations(), getSettings(), searchParams]);
  return (
    <PlanogramBoard
      planograms={planograms}
      locations={locations}
      today={operationalToday(new Date(), settings.dayRolloverHour)}
      startCreating={nuevo === "1"}
    />
  );
}

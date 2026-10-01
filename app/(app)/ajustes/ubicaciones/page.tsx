import { LocationsManager } from "@/components/settings/LocationsManager";
import { db } from "@/lib/db";

export const metadata = { title: "Ubicaciones" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.shelfLocation.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, _count: { select: { planograms: true } } },
  });
  return <LocationsManager locations={rows.map(({ _count, ...l }) => ({ ...l, count: _count.planograms }))} />;
}

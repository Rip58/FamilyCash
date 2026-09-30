import { StatusesManager } from "@/components/settings/StatusesManager";
import { db } from "@/lib/db";
import { getStatusTypes } from "@/lib/queries";

export const metadata = { title: "Estados" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [statuses, counts] = await Promise.all([
    getStatusTypes(),
    db.dayEntry.groupBy({ by: ["statusTypeId"], _count: { _all: true } }),
  ]);
  const usage = new Map(counts.map((c) => [c.statusTypeId, c._count._all]));
  return (
    <StatusesManager
      statuses={statuses.map((s) => ({
        id: s.id,
        code: s.code,
        label: s.label,
        color: s.color,
        isWorking: s.isWorking,
        active: s.active ?? true,
        usage: usage.get(s.id) ?? 0,
      }))}
    />
  );
}

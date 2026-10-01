import { ProtocolList } from "@/components/protocols/ProtocolList";
import { db } from "@/lib/db";
import { stepSelect, toStepView } from "@/lib/planogram-queries";

export const metadata = { title: "Protocolos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.protocol.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      body: true,
      steps: { orderBy: { sortOrder: "asc" }, select: stepSelect },
    },
  });
  return <ProtocolList initial={rows.map((r) => ({ ...r, steps: r.steps.map(toStepView) }))} />;
}

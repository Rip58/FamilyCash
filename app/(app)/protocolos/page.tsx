import { ProtocolList } from "@/components/protocols/ProtocolList";
import { db } from "@/lib/db";

export const metadata = { title: "Protocolos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.protocol.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true, category: true, body: true },
  });
  return <ProtocolList initial={rows} />;
}

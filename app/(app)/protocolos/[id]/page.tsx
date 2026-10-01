import { notFound } from "next/navigation";
import { ProtocolEditor } from "@/components/protocols/ProtocolEditor";
import { db } from "@/lib/db";
import { stepSelect, toStepView } from "@/lib/planogram-queries";

export const metadata = { title: "Editar protocolo" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [all, current] = await Promise.all([
    db.protocol.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] }),
    id === "nuevo" ? Promise.resolve(null) : db.protocol.findUnique({
          where: { id },
          include: { steps: { orderBy: { sortOrder: "asc" }, select: stepSelect } },
        }),
  ]);
  if (id !== "nuevo" && !current) notFound();
  const categories = all.map((c) => c.category).filter((c): c is string => !!c).sort((a, b) => a.localeCompare(b, "es"));
  return (
    <ProtocolEditor
      key={id}
      id={current ? current.id : null}
      initial={{ title: current?.title ?? "", category: current?.category ?? "", body: current?.body ?? "", steps: current?.steps.map(toStepView) ?? [] }}
      categories={categories}
    />
  );
}

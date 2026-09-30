import { SectionsManager } from "@/components/settings/SectionsManager";
import { getDepartments, getSections } from "@/lib/queries";

export const metadata = { title: "Secciones" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [sections, departments] = await Promise.all([getSections(), getDepartments()]);
  return (
    <SectionsManager
      sections={sections.map((s) => ({ id: s.id, name: s.name, departmentId: s.departmentId, active: s.active }))}
      departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color, active: d.active ?? true }))}
    />
  );
}

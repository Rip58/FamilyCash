import { DepartmentsManager } from "@/components/settings/DepartmentsManager";
import { getDepartments, getEmployees } from "@/lib/queries";

export const metadata = { title: "Departamentos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [departments, employees] = await Promise.all([getDepartments(), getEmployees()]);
  return (
    <DepartmentsManager
      departments={departments.map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
        targetStaff: d.targetStaff,
        active: d.active ?? true,
      }))}
      employees={employees
        .filter((e) => e.active)
        .map((e) => ({ id: e.id, name: e.name, defaultDepartmentId: e.defaultDepartmentId }))}
    />
  );
}

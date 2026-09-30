import { EmployeesManager } from "@/components/settings/EmployeesManager";
import { db } from "@/lib/db";
import { getDepartments, getEmployees } from "@/lib/queries";

export const metadata = { title: "Empleados" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [employees, departments, counts] = await Promise.all([
    getEmployees(),
    getDepartments(),
    db.dayEntry.groupBy({ by: ["employeeId"], _count: { _all: true } }),
  ]);
  const entryCount = new Map(counts.map((c) => [c.employeeId, c._count._all]));
  return (
    <EmployeesManager
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        defaultDepartmentId: e.defaultDepartmentId,
        fixedDaysOff: e.fixedDaysOff,
        active: e.active,
        notes: e.notes ?? null,
        entryCount: entryCount.get(e.id) ?? 0,
      }))}
      departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color, active: d.active ?? true }))}
    />
  );
}

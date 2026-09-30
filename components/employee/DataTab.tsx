"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { type DeptOption, EditEmployee, type EmployeeRow } from "@/components/settings/EmployeesManager";

/** Pestaña Datos: el formulario de edición de siempre (guardado al cambiar cada campo). */
export function DataTab({ employee, departments }: { employee: EmployeeRow; departments: DeptOption[] }) {
  const router = useRouter();
  return (
    <Card>
      <EditEmployee
        employee={employee}
        departments={departments}
        onClose={() => {
          router.push("/ajustes/empleados");
          router.refresh();
        }}
      />
    </Card>
  );
}

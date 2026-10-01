import { PayrollSettingsForm } from "@/components/settings/PayrollSettingsForm";
import { getPayrollConfig } from "@/lib/payroll-queries";
import { getEmployees } from "@/lib/queries";

export const metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [config, employees] = await Promise.all([getPayrollConfig(), getEmployees()]);
  return (
    <PayrollSettingsForm
      initial={config}
      employees={employees
        .filter((e) => e.active || e.id === config.employeeId)
        .map((e) => ({ id: e.id, name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"))}
    />
  );
}

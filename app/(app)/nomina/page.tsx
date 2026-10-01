import { PayrollView } from "@/components/payroll/PayrollView";
import { addMonths, madridToday, monthOf } from "@/lib/dates";
import { getPayrollConfig, loadPayrollMonths } from "@/lib/payroll-queries";
import { getEmployees } from "@/lib/queries";

export const metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const config = await getPayrollConfig();
  const current = monthOf(madridToday());
  const [months, employees] = await Promise.all([
    loadPayrollMonths(addMonths(current, -11), current, config.employeeId),
    getEmployees(),
  ]);
  const me = config.employeeId ? employees.find((e) => e.id === config.employeeId) : undefined;
  return (
    <PayrollView
      months={[...months].reverse()}
      config={config}
      employeeName={me?.name ?? null}
      initialView={v === "calculadora" ? "calculadora" : "registro"}
    />
  );
}

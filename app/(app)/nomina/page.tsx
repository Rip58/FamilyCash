import { PayrollView } from "@/components/payroll/PayrollView";
import { addMonths, madridToday, monthOf } from "@/lib/dates";
import { getPayrollConfig, getPayrollPeriods, loadPayrollMonths } from "@/lib/payroll-queries";
import { getEmployees } from "@/lib/queries";

export const metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const config = await getPayrollConfig();
  const current = monthOf(madridToday());
  const periods = await getPayrollPeriods();
  // Desde el primer periodo de salario (inicio del contrato) hasta diciembre del año siguiente.
  const first = periods[0] ? monthOf(periods[0].from) : addMonths(current, -11);
  const last = `${Number(current.slice(0, 4)) + 1}-12`;
  const [months, employees] = await Promise.all([loadPayrollMonths(first, last, config.employeeId), getEmployees()]);
  const me = config.employeeId ? employees.find((e) => e.id === config.employeeId) : undefined;
  return (
    <PayrollView
      months={[...months].reverse()}
      current={current}
      periods={periods}
      config={config}
      employeeName={me?.name ?? null}
      initialView={v === "calculadora" ? "calculadora" : "registro"}
    />
  );
}

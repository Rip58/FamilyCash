import { PayrollView } from "@/components/payroll/PayrollView";
import { addMonths, madridToday, payMonthOf } from "@/lib/dates";
import { getPayrollConfig, getPayrollPeriods, loadPayrollMonths } from "@/lib/payroll-queries";
import { getEmployees, getSettings } from "@/lib/queries";

export const metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const [config, periods] = await Promise.all([getPayrollConfig(), getPayrollPeriods()]);
  // Nómina en curso: después del día de cierre ya es la del mes siguiente.
  const current = payMonthOf(madridToday(), config.cutoffDay);
  // Desde el primer periodo de salario (inicio del contrato) hasta diciembre del año siguiente.
  const first = periods[0] ? payMonthOf(periods[0].from, config.cutoffDay) : addMonths(current, -11);
  const last = `${Number(current.slice(0, 4)) + 1}-12`;
  const [{ months, forecast }, employees, settings] = await Promise.all([
    loadPayrollMonths(first, last, config.employeeId, config.cutoffDay),
    getEmployees(),
    getSettings(),
  ]);
  const me = config.employeeId ? employees.find((e) => e.id === config.employeeId) : undefined;
  return (
    <PayrollView
      months={[...months].reverse()}
      current={current}
      periods={periods}
      config={config}
      employeeName={me?.name ?? null}
      forecast={forecast}
      daysOffPerWeek={settings.daysOffPerWeek}
      initialView={v === "calculadora" ? "calculadora" : "registro"}
    />
  );
}

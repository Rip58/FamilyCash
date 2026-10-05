import Link from "next/link";
import { EmployeeHistoryView } from "@/components/report/EmployeeHistoryView";
import { EmployeePicker } from "@/components/report/EmployeePicker";
import { loadEmployeeHistory } from "@/lib/employee-history-queries";
import { getEmployees } from "@/lib/queries";

export const metadata = { title: "Historial de empleado" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const [{ id }, employees] = await Promise.all([searchParams, getEmployees()]);
  const people = employees
    .map((e) => ({ id: e.id, name: e.name, active: e.active }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es"));
  const selected = id ? people.find((p) => p.id === id) : undefined;
  const items = selected ? await loadEmployeeHistory(selected.id) : [];

  return (
    <div className="space-y-3 pb-4 pt-2">
      <header className="flex min-h-12 items-center gap-1">
        <Link href="/informe" aria-label="Volver al informe" className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-accent">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 2 2 10l8 8" />
          </svg>
        </Link>
        <h1 className="flex-1 truncate text-[22px] font-bold tracking-tight">Historial de empleado</h1>
      </header>
      <EmployeePicker people={people} selectedId={selected?.id ?? null} />
      {selected ? (
        <EmployeeHistoryView key={selected.id} name={selected.name} items={items} currentYear={new Date().getFullYear()} />
      ) : (
        <p className="px-1 text-[14px] text-muted">
          Busca un empleado para ver todo lo apuntado sobre él, noche a noche: notas de la noche y de su ficha, avisos,
          faltas, horarios, horas extra y peticiones. Luego lo puedes compartir o copiar.
        </p>
      )}
    </div>
  );
}

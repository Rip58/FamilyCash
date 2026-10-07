import Link from "next/link";
import { EmployeeHistoryView } from "@/components/report/EmployeeHistoryView";
import { EmployeePicker, type PickerOption } from "@/components/report/EmployeePicker";
import { loadEmployeeHistory, loadNotesHistory } from "@/lib/employee-history-queries";
import { getDepartments, getEmployees, getSections } from "@/lib/queries";

export const metadata = { title: "Historial" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; s?: string; dep?: string }> }) {
  const [{ id, s, dep }, employees, departments, sections] = await Promise.all([searchParams, getEmployees(), getDepartments(), getSections()]);
  const people = [...employees].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es"));
  const options: PickerOption[] = [
    { key: "s:all", name: "Todas las notas", href: "/informe/empleado?s=all", group: "Notas", hint: "de todos" },
    { key: "s:general", name: "Notas generales", href: "/informe/empleado?s=general", group: "Notas", hint: "sin persona" },
    ...departments
      .filter((d) => d.active !== false)
      .map((d): PickerOption => ({ key: `d:${d.id}`, name: d.name, href: `/informe/empleado?dep=${d.id}`, group: "Departamentos" })),
    ...people.map((e): PickerOption => ({
      key: `e:${e.id}`,
      name: e.name,
      href: `/informe/empleado?id=${e.id}`,
      group: "Empleados",
      muted: !e.active,
      hint: e.active ? undefined : "baja",
    })),
  ];
  const key = id ? `e:${id}` : dep ? `d:${dep}` : s === "all" || s === "general" ? `s:${s}` : null;
  const selected = options.find((o) => o.key === key) ?? null;
  const items = !selected
    ? []
    : selected.group === "Empleados"
      ? await loadEmployeeHistory(id!)
      : selected.group === "Departamentos"
        ? await loadNotesHistory({ kind: "department", departmentId: dep! })
        : await loadNotesHistory({ kind: s === "all" ? "all" : "general" });

  const noteOptions = {
    employees: people.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name })),
    departments: departments.filter((d) => d.active !== false).map((d) => ({ id: d.id, name: d.name })),
    sections: sections.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name })),
  };

  return (
    <div className="space-y-3 pb-4 pt-2">
      <header className="flex min-h-12 items-center gap-1">
        <Link href="/informe" aria-label="Volver al informe" className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-accent">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 2 2 10l8 8" />
          </svg>
        </Link>
        <h1 className="flex-1 truncate text-[22px] font-bold tracking-tight">Historial</h1>
      </header>
      <EmployeePicker options={options} selectedKey={selected?.key ?? null} />
      {selected ? (
        <EmployeeHistoryView
          key={selected.key}
          name={selected.name}
          heading={selected.group === "Empleados" ? undefined : `📝 ${selected.name.toUpperCase()}`}
          items={items}
          noteOptions={noteOptions}
          currentYear={new Date().getFullYear()}
        />
      ) : (
        <p className="px-1 text-[14px] text-muted">
          Elige qué quieres ver: todas las notas, las generales, un departamento o un empleado (con sus notas, faltas,
          vacaciones, horarios y horas extra). Luego lo puedes filtrar por tipo, compartir o copiar.
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { deleteEmployee, saveEmployee } from "@/app/actions/settings";
import { WEEKDAY_LETTERS } from "@/lib/dates";
import {
  AddButton, BackHeader, ConfirmButton, Field, PrimaryButton, TextInput, Toggle, inputClass, useRun,
} from "./kit";

export interface EmployeeRow {
  id: string;
  name: string;
  alias: string | null;
  defaultDepartmentId: string | null;
  fixedDaysOff: number[];
  active: boolean;
  notes: string | null;
  entryCount: number;
}
export interface DeptOption {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function daysLabel(days: number[]): string {
  return days.length ? `Libra: ${days.map((d) => WEEKDAY_LETTERS[d]).join(" ")}` : "Sin días fijos";
}

export function DepartmentSelect({
  value,
  onChange,
  departments,
  label = "Departamento habitual",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  departments: DeptOption[];
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputClass}
    >
      <option value="">Sin asignar</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
          {d.active ? "" : " (inactivo)"}
        </option>
      ))}
    </select>
  );
}

export function EmployeesManager({ employees, departments }: { employees: EmployeeRow[]; departments: DeptOption[] }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const { groups, inactive } = useMemo(() => {
    const q = norm(query.trim());
    const match = (e: EmployeeRow) => !q || norm(e.name).includes(q) || norm(e.alias ?? "").includes(q);
    const active = employees.filter((e) => e.active && match(e));
    const groups = [
      ...departments.map((d) => ({ key: d.id, title: d.name, color: d.color as string | null, list: active.filter((e) => e.defaultDepartmentId === d.id) })),
      { key: "none", title: "Sin asignar", color: null, list: active.filter((e) => !e.defaultDepartmentId || !departments.some((d) => d.id === e.defaultDepartmentId)) },
    ].filter((g) => g.list.length > 0);
    return { groups, inactive: employees.filter((e) => !e.active && match(e)) };
  }, [employees, departments, query]);

  const row = (e: EmployeeRow) => (
    <Link
      key={e.id}
      href={`/ajustes/empleados/${e.id}`}
      className="flex min-h-14 w-full items-center justify-between gap-3 border-t border-line px-4 py-2 text-left first:border-t-0 active:bg-surface-2"
    >
      <span className="min-w-0">
        <span className="block truncate text-[17px]">
          {e.name}
          {e.alias ? <span className="text-muted"> · {e.alias}</span> : null}
        </span>
        <span className="block truncate text-[13px] text-muted">
          {daysLabel(e.fixedDaysOff)}
          {e.notes ? " · con nota" : ""}
        </span>
      </span>
      <span aria-hidden className="text-muted">›</span>
    </Link>
  );

  return (
    <div>
      <BackHeader title="Empleados" action={<AddButton label="Añadir" onClick={() => setCreating(true)} />} />
      <input
        type="search"
        aria-label="Buscar empleado"
        placeholder="Buscar"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`${inputClass} mb-4`}
      />
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <Card
            key={g.key}
            flush
            title={
              <span className="flex items-center gap-2">
                {g.color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />}
                {g.title} · {g.list.length}
              </span>
            }
          >
            {g.list.map(row)}
          </Card>
        ))}
        {groups.length === 0 && inactive.length === 0 && (
          <p className="py-8 text-center text-muted">No hay empleados{query ? " con ese nombre" : ""}.</p>
        )}
        {inactive.length > 0 && (
          <details className="rounded-card bg-surface">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[15px] font-medium text-muted">
              Inactivos ({inactive.length})
            </summary>
            <div>{inactive.map(row)}</div>
          </details>
        )}
      </div>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title="Nuevo empleado">
        {creating && <NewEmployee departments={departments} onDone={() => setCreating(false)} />}
      </BottomSheet>
    </div>
  );
}

export function DaysChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex justify-between gap-1" role="group" aria-label="Días fijos de fiesta">
      {WEEKDAY_LETTERS.map((l, i) => (
        <Chip
          key={l}
          selected={value.includes(i)}
          aria-label={`Fiesta fija ${["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][i]}`}
          className="!min-w-11 !px-0 flex-1"
          onClick={() => onChange(value.includes(i) ? value.filter((d) => d !== i) : [...value, i].sort())}
        >
          {l}
        </Chip>
      ))}
    </div>
  );
}

function NewEmployee({ departments, onDone }: { departments: DeptOption[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [dept, setDept] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const { pending, run } = useRun();
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} autoFocus />
      </Field>
      <Field label="Alias (vista Semana)">
        <input aria-label="Alias" value={alias} onChange={(e) => setAlias(e.target.value)} className={inputClass} maxLength={12} placeholder="Ej.: Gerard, Jose A." />
      </Field>
      <Field label="Departamento habitual">
        <DepartmentSelect value={dept} onChange={setDept} departments={departments.filter((d) => d.active)} />
      </Field>
      <Field label="Días fijos de fiesta">
        <DaysChips value={days} onChange={setDays} />
      </Field>
      <Field label="Nota permanente">
        <textarea aria-label="Nota permanente" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} py-2`} maxLength={500} />
      </Field>
      <PrimaryButton
        className="mt-2 w-full"
        disabled={pending || !name.trim()}
        onClick={() =>
          run(() => saveEmployee({ name, alias, defaultDepartmentId: dept, fixedDaysOff: days, notes, active: true }), {
            msg: "Empleado añadido",
            onDone,
          })
        }
      >
        Añadir empleado
      </PrimaryButton>
    </div>
  );
}

export function EditEmployee({
  employee: initial,
  departments,
  onClose,
}: {
  employee: EmployeeRow;
  departments: DeptOption[];
  onClose: () => void;
}) {
  const { pending, run } = useRun();
  const [employee, setEmployee] = useState(initial);
  const save = (patch: Partial<EmployeeRow>) => {
    const next = { ...employee, ...patch };
    setEmployee(next);
    run(() =>
      saveEmployee({
        id: next.id,
        name: next.name,
        alias: next.alias,
        defaultDepartmentId: next.defaultDepartmentId,
        fixedDaysOff: next.fixedDaysOff,
        notes: next.notes,
        active: next.active,
      }),
    );
  };
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <TextInput label="Nombre" value={employee.name} maxLength={80} onCommit={(v) => v.trim() && save({ name: v })} />
      </Field>
      <Field label="Alias (vista Semana)">
        <TextInput label="Alias" value={employee.alias ?? ""} maxLength={12} onCommit={(v) => save({ alias: v.trim() || null })} />
        <p className="mt-1 text-[12px] text-muted">Nombre corto que se ve en la cuadrícula semanal. Hasta 12 letras; mejor 8–10.</p>
      </Field>
      <Field label="Departamento habitual">
        <DepartmentSelect
          value={employee.defaultDepartmentId}
          onChange={(v) => save({ defaultDepartmentId: v })}
          departments={departments.filter((d) => d.active || d.id === employee.defaultDepartmentId)}
        />
      </Field>
      <Field label="Días fijos de fiesta">
        <DaysChips value={employee.fixedDaysOff} onChange={(v) => save({ fixedDaysOff: v })} />
      </Field>
      <Field label="Nota permanente">
        <TextInput label="Nota permanente" multiline maxLength={500} value={employee.notes ?? ""} onCommit={(v) => save({ notes: v })} />
      </Field>
      <Toggle label="Activo" checked={employee.active} onChange={(v) => save({ active: v })} disabled={pending} />
      <div className="mt-2">
        {employee.entryCount === 0 ? (
          <ConfirmButton
            label="Borrar empleado"
            onConfirm={() => run(() => deleteEmployee(employee.id), { msg: "Empleado borrado", onDone: onClose })}
          />
        ) : (
          <p className="text-[13px] text-muted">
            Tiene historial ({employee.entryCount} registro{employee.entryCount === 1 ? "" : "s"}): no se puede borrar,
            solo desactivar.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import {
  deleteDepartment, moveEmployee, reorderDepartments, reorderEmployees, saveDepartment,
} from "@/app/actions/settings";
import { COLOR_PALETTE } from "@/lib/settings-logic";
import {
  AddButton, BackHeader, ColorPicker, ConfirmButton, Field, PrimaryButton, SortableList, Stepper, TextInput,
  Toggle, inputClass, useRun,
} from "./kit";

export interface DeptRow {
  id: string;
  name: string;
  color: string;
  targetStaff: number;
  active: boolean;
  secondary: boolean;
}
export interface EmpRow {
  id: string;
  name: string;
  defaultDepartmentId: string | null;
}

export function DepartmentsManager({ departments, employees }: { departments: DeptRow[]; employees: EmpRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const { run } = useRun();
  const assigning = departments.find((d) => d.id === assigningId) ?? null;
  const editing = departments.find((d) => d.id === editingId) ?? null;
  const known = new Set(departments.map((d) => d.id));
  const unassigned = employees.filter((e) => !e.defaultDepartmentId || !known.has(e.defaultDepartmentId));

  return (
    <div>
      <BackHeader title="Departamentos" action={<AddButton label="Añadir" onClick={() => setCreating(true)} />} />
      <p className="mb-3 px-1 text-[13px] text-muted">
        Asignación oficial (departamento habitual). Los cambios del día a día por fiestas o bajas se hacen en Hoy.
      </p>
      <p className="mb-3 px-1 text-[13px] text-muted">
        Arrastra <span aria-hidden>⠿</span> para reordenar. Abre un departamento con › para asignar, ordenar o mover sus
        empleados.
      </p>
      <div className="flex flex-col gap-3">
        <SortableList
          items={departments}
          onReorder={(ids) => run(() => reorderDepartments(ids), { msg: "Orden guardado" })}
          render={(d, handle) => {
            const list = employees.filter((e) => e.defaultDepartmentId === d.id);
            const isOpen = !!open[d.id];
            return (
              <div className={cn("mb-3 overflow-hidden rounded-card bg-surface", !d.active && "opacity-60")}>
                <div className="flex items-center gap-1 pr-2">
                  {handle}
                  <button
                    type="button"
                    onClick={() => setEditingId(d.id)}
                    aria-label={`Editar ${d.name}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[17px] font-medium">
                        {d.name}
                        {!d.active && " (inactivo)"}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {list.length} empleado{list.length === 1 ? "" : "s"} · {d.targetStaff} plaza
                        {d.targetStaff === 1 ? "" : "s"}
                        {d.secondary && " · secundario"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `Ocultar empleados de ${d.name}` : `Ver empleados de ${d.name}`}
                    onClick={() => setOpen((o) => ({ ...o, [d.id]: !isOpen }))}
                    className="flex min-h-11 min-w-11 items-center justify-center text-muted"
                  >
                    <span className={cn("transition-transform", isOpen && "rotate-90")}>›</span>
                  </button>
                </div>
                {isOpen && (
                  <>
                    <EmployeeOrder list={list} departments={departments} empty="Sin empleados en este departamento." />
                    <button
                      type="button"
                      onClick={() => setAssigningId(d.id)}
                      className="flex min-h-12 w-full items-center border-t border-line px-4 text-left text-[16px] font-semibold text-accent"
                    >
                      + Asignar empleados
                    </button>
                  </>
                )}
              </div>
            );
          }}
        />
        {departments.length === 0 && <p className="py-6 text-center text-muted">Aún no hay departamentos.</p>}
        {unassigned.length > 0 && (
          <Card title={`Sin asignar · ${unassigned.length}`} flush>
            <EmployeeOrder list={unassigned} departments={departments} empty="" />
          </Card>
        )}
      </div>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title="Nuevo departamento">
        {creating && <NewDepartment onDone={() => setCreating(false)} />}
      </BottomSheet>
      <BottomSheet
        open={!!assigning}
        onClose={() => setAssigningId(null)}
        title={assigning ? `Empleados de ${assigning.name}` : "Asignar"}
      >
        {assigning && <AssignEmployees key={assigning.id} dept={assigning} departments={departments} employees={employees} />}
      </BottomSheet>
      <BottomSheet open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? "Departamento"}>
        {editing && (
          <EditDepartment
            key={editing.id}
            dept={editing}
            count={employees.filter((e) => e.defaultDepartmentId === editing.id).length}
            onClose={() => setEditingId(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function EmployeeOrder({ list, departments, empty }: { list: EmpRow[]; departments: DeptRow[]; empty: string }) {
  const { run } = useRun();
  if (list.length === 0) return empty ? <p className="border-t border-line px-4 py-3 text-[14px] text-muted">{empty}</p> : null;
  return (
    <div className="border-t border-line">
      <SortableList
        items={list}
        onReorder={(ids) => run(() => reorderEmployees(ids), { msg: "Orden guardado" })}
        render={(e, handle) => (
          <div className="flex items-center gap-1 border-b border-line bg-surface pr-3 last:border-b-0">
            {handle}
            <span className="min-w-0 flex-1 truncate text-[16px]">{e.name}</span>
            <select
              aria-label={`Mover a ${e.name}`}
              value={e.defaultDepartmentId ?? ""}
              onChange={(ev) =>
                run(() => moveEmployee({ id: e.id, departmentId: ev.target.value || null }), { msg: "Empleado movido" })
              }
              className="min-h-11 max-w-[42%] rounded-control bg-surface-2 px-2 text-[14px]"
            >
              <option value="">Sin asignar</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      />
    </div>
  );
}

function AssignEmployees({ dept, departments, employees }: { dept: DeptRow; departments: DeptRow[]; employees: EmpRow[] }) {
  const { run } = useRun();
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const current = (e: EmpRow) => (e.id in overrides ? overrides[e.id] : e.defaultDepartmentId);
  const [order] = useState(() =>
    [...employees]
      .sort(
        (a, b) =>
          Number(b.defaultDepartmentId === dept.id) - Number(a.defaultDepartmentId === dept.id) ||
          a.name.localeCompare(b.name, "es"),
      )
      .map((e) => e.id),
  );
  const byId = new Map(employees.map((e) => [e.id, e]));
  const q = query.trim().toLocaleLowerCase("es");
  const rows = order
    .map((id) => byId.get(id))
    .filter((e): e is EmpRow => !!e && (!q || e.name.toLocaleLowerCase("es").includes(q)));
  const count = employees.filter((e) => current(e) === dept.id).length;

  function toggle(e: EmpRow) {
    const next = current(e) === dept.id ? null : dept.id;
    setOverrides((o) => ({ ...o, [e.id]: next }));
    run(() => moveEmployee({ id: e.id, departmentId: next }), {
      msg: next ? `${e.name} → ${dept.name}` : `${e.name} sin asignar`,
    });
  }

  return (
    <div className="pb-2">
      <p className="mb-2 text-[13px] text-muted">
        {count} asignado{count === 1 ? "" : "s"} · {dept.targetStaff} plaza{dept.targetStaff === 1 ? "" : "s"}. Marca quién
        pertenece oficialmente a este departamento.
      </p>
      <input
        type="search"
        aria-label="Buscar empleado"
        placeholder="Buscar empleado"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputClass}
      />
      <ul className="mt-2">
        {rows.map((e) => {
          const cur = current(e);
          const checked = cur === dept.id;
          const other = !checked && cur ? deptName.get(cur) : null;
          return (
            <li key={e.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(e)}
                className="flex min-h-12 w-full items-center gap-3 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-bold",
                    checked ? "border-accent bg-accent text-white" : "border-line",
                  )}
                >
                  {checked && "✓"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px]">{e.name}</span>
                  {other && <span className="block truncate text-[12px] text-muted">Ahora en {other}</span>}
                  {!checked && !cur && <span className="block text-[12px] text-muted">Sin asignar</span>}
                </span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-4 text-center text-muted">Ningún empleado coincide.</li>}
      </ul>
    </div>
  );
}

function NewDepartment({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLOR_PALETTE[6]);
  const [target, setTarget] = useState(1);
  const { pending, run } = useRun();
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} autoFocus />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Plazas previstas">
        <Stepper label="Plazas previstas" value={target} onChange={setTarget} />
      </Field>
      <PrimaryButton
        className="mt-2 w-full"
        disabled={pending || !name.trim()}
        onClick={() =>
          run(() => saveDepartment({ name, color, targetStaff: target, active: true }), {
            msg: "Departamento añadido",
            onDone,
          })
        }
      >
        Añadir departamento
      </PrimaryButton>
    </div>
  );
}

function EditDepartment({ dept: initial, count, onClose }: { dept: DeptRow; count: number; onClose: () => void }) {
  const [dept, setDept] = useState(initial);
  const { pending, run } = useRun();
  const save = (patch: Partial<DeptRow>) => {
    const next = { ...dept, ...patch };
    setDept(next);
    run(() => saveDepartment(next));
  };
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <TextInput label="Nombre" value={dept.name} maxLength={80} onCommit={(v) => v.trim() && save({ name: v })} />
      </Field>
      <Field label="Color">
        <ColorPicker value={dept.color} onChange={(c) => save({ color: c })} />
      </Field>
      <Field label="Plazas previstas">
        <Stepper label="Plazas previstas" value={dept.targetStaff} onChange={(v) => save({ targetStaff: v })} />
      </Field>
      <Toggle label="Activo" checked={dept.active} onChange={(v) => save({ active: v })} disabled={pending} />
      <Toggle
        label="Secundario (tareas de todos)"
        checked={dept.secondary}
        onChange={(v) => save({ secondary: v })}
        disabled={pending}
      />
      <p className="-mt-1 mb-1 text-[13px] text-muted">
        Comodín, palets… Si nadie lo tiene asignado no sale en Hoy ni cuenta como «sin personal».
      </p>
      <div className="mt-2">
        {count === 0 ? (
          <ConfirmButton
            label="Borrar departamento"
            onConfirm={() => run(() => deleteDepartment(dept.id), { msg: "Departamento borrado", onDone: onClose })}
          />
        ) : (
          <p className="text-[13px] text-muted">Tiene empleados asignados: muévelos para poder borrarlo, o desactívalo.</p>
        )}
      </div>
    </div>
  );
}

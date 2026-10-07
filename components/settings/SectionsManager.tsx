"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { deleteSection, reorderSections, saveSection } from "@/app/actions/settings";
import { DepartmentSelect, type DeptOption } from "./EmployeesManager";
import {
  AddButton, BackHeader, ConfirmButton, Field, PrimaryButton, SortableList, TextInput, Toggle, inputClass, useRun,
} from "./kit";

export interface SectionRow {
  id: string;
  name: string;
  departmentId: string | null;
  active: boolean;
}

export function SectionsManager({ sections, departments }: { sections: SectionRow[]; departments: DeptOption[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { run } = useRun();
  const editing = sections.find((s) => s.id === editingId) ?? null;
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "Todos los departamentos";

  return (
    <div>
      <BackHeader title="Secciones" action={<AddButton label="Añadir" onClick={() => setCreating(true)} />} />
      <p className="mb-3 px-1 text-[13px] text-muted">
        Pasillos o tareas para los tramos de trabajo. Arrastra para reordenar.
      </p>
      <div className="overflow-hidden rounded-card bg-surface">
        <SortableList
          items={sections}
          onReorder={(ids) => run(() => reorderSections(ids), { msg: "Orden guardado" })}
          render={(s, handle) => (
            <div className={cn("flex items-center gap-1 border-b border-line bg-surface pr-2", !s.active && "opacity-60")}>
              {handle}
              <button
                type="button"
                onClick={() => setEditingId(s.id)}
                className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left"
              >
                <span className="truncate text-[17px]">
                  {s.name}
                  {!s.active && " (inactiva)"}
                </span>
                <span className="truncate text-[13px] text-muted">{deptName(s.departmentId)}</span>
              </button>
              <span aria-hidden className="text-muted">›</span>
            </div>
          )}
        />
        {sections.length === 0 && <p className="p-6 text-center text-muted">Aún no hay secciones.</p>}
      </div>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title="Nueva sección">
        {creating && <NewSection departments={departments} onDone={() => setCreating(false)} />}
      </BottomSheet>
      <BottomSheet open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? "Sección"}>
        {editing && (
          <EditSection key={editing.id} section={editing} departments={departments} onClose={() => setEditingId(null)} />
        )}
      </BottomSheet>
    </div>
  );
}

function NewSection({ departments, onDone }: { departments: DeptOption[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [dept, setDept] = useState<string | null>(null);
  const { pending, run } = useRun();
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} autoFocus />
      </Field>
      <Field label="Departamento (opcional)">
        <DepartmentSelect noneLabel="Ninguno" value={dept} onChange={setDept} departments={departments.filter((d) => d.active)} />
      </Field>
      <PrimaryButton
        className="mt-2 w-full"
        disabled={pending || !name.trim()}
        onClick={() => run(() => saveSection({ name, departmentId: dept, active: true }), { msg: "Sección añadida", onDone })}
      >
        Añadir sección
      </PrimaryButton>
    </div>
  );
}

function EditSection({
  section: initial,
  departments,
  onClose,
}: {
  section: SectionRow;
  departments: DeptOption[];
  onClose: () => void;
}) {
  const [section, setSection] = useState(initial);
  const { pending, run } = useRun();
  const save = (patch: Partial<SectionRow>) => {
    const next = { ...section, ...patch };
    setSection(next);
    run(() => saveSection(next));
  };
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <TextInput label="Nombre" value={section.name} maxLength={80} onCommit={(v) => v.trim() && save({ name: v })} />
      </Field>
      <Field label="Departamento (opcional)">
        <DepartmentSelect
          noneLabel="Ninguno"
          value={section.departmentId}
          onChange={(v) => save({ departmentId: v })}
          departments={departments.filter((d) => d.active || d.id === section.departmentId)}
        />
      </Field>
      <Toggle label="Activa" checked={section.active} onChange={(v) => save({ active: v })} disabled={pending} />
      <div className="mt-2">
        <ConfirmButton
          label="Borrar sección"
          onConfirm={() => run(() => deleteSection(section.id), { msg: "Sección borrada", onDone: onClose })}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { deleteStatus, reorderStatuses, saveStatus } from "@/app/actions/settings";
import { COLOR_PALETTE, isProtectedStatus, slugCode } from "@/lib/settings-logic";
import {
  AddButton, BackHeader, ColorPicker, ConfirmButton, Field, PrimaryButton, SortableList, TextInput, Toggle,
  inputClass, useRun,
} from "./kit";

export interface StatusRow {
  id: string;
  code: string;
  label: string;
  color: string;
  isWorking: boolean;
  active: boolean;
  usage: number;
}

export function StatusesManager({ statuses }: { statuses: StatusRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { run } = useRun();
  const editing = statuses.find((s) => s.id === editingId) ?? null;

  return (
    <div>
      <BackHeader title="Estados" action={<AddButton label="Añadir" onClick={() => setCreating(true)} />} />
      <p className="mb-3 px-1 text-[13px] text-muted">
        “Trabaja” y “Fiesta” no se pueden borrar ni desactivar. Arrastra para reordenar.
      </p>
      <div className="overflow-hidden rounded-card bg-surface">
        <SortableList
          items={statuses}
          onReorder={(ids) => run(() => reorderStatuses(ids), { msg: "Orden guardado" })}
          render={(s, handle) => (
            <div className={cn("flex items-center gap-1 border-b border-line bg-surface pr-2", !s.active && "opacity-60")}>
              {handle}
              <button
                type="button"
                onClick={() => setEditingId(s.id)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0">
                  <span className="block truncate text-[17px]">
                    {s.label}
                    {!s.active && " (inactivo)"}
                  </span>
                  <span className="block text-[13px] text-muted">{s.isWorking ? "Cuenta como trabajando" : "No trabaja"}</span>
                </span>
              </button>
              <span aria-hidden className="text-muted">›</span>
            </div>
          )}
        />
      </div>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title="Nuevo estado">
        {creating && <NewStatus onDone={() => setCreating(false)} />}
      </BottomSheet>
      <BottomSheet open={!!editing} onClose={() => setEditingId(null)} title={editing?.label ?? "Estado"}>
        {editing && <EditStatus key={editing.id} status={editing} onClose={() => setEditingId(null)} />}
      </BottomSheet>
    </div>
  );
}

function NewStatus({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>(COLOR_PALETTE[7]);
  const [isWorking, setIsWorking] = useState(false);
  const { pending, run } = useRun();
  return (
    <div className="pb-2">
      <Field label="Etiqueta" hint={label.trim() ? `Código: ${slugCode(label)}` : undefined}>
        <input aria-label="Etiqueta" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} maxLength={40} autoFocus />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Toggle label="Cuenta como trabajando" checked={isWorking} onChange={setIsWorking} />
      <PrimaryButton
        className="mt-2 w-full"
        disabled={pending || !label.trim()}
        onClick={() => run(() => saveStatus({ label, color, isWorking, active: true }), { msg: "Estado añadido", onDone })}
      >
        Añadir estado
      </PrimaryButton>
    </div>
  );
}

function EditStatus({ status: initial, onClose }: { status: StatusRow; onClose: () => void }) {
  const [status, setStatus] = useState(initial);
  const { pending, run } = useRun();
  const locked = isProtectedStatus(status.code);
  const save = (patch: Partial<StatusRow>) => {
    const next = { ...status, ...patch };
    setStatus(next);
    run(() =>
      saveStatus({ id: next.id, label: next.label, color: next.color, isWorking: next.isWorking, active: next.active }),
    );
  };
  return (
    <div className="pb-2">
      <Field label="Etiqueta" hint={`Código: ${status.code}`}>
        <TextInput label="Etiqueta" value={status.label} maxLength={40} onCommit={(v) => v.trim() && save({ label: v })} />
      </Field>
      <Field label="Color">
        <ColorPicker value={status.color} onChange={(c) => save({ color: c })} />
      </Field>
      <Toggle label="Cuenta como trabajando" checked={status.isWorking} onChange={(v) => save({ isWorking: v })} disabled={pending || locked} />
      <Toggle label="Activo" checked={status.active} onChange={(v) => save({ active: v })} disabled={pending || locked} />
      <div className="mt-2">
        {locked ? (
          <p className="text-[13px] text-muted">Estado del sistema: solo puedes cambiar su nombre y color.</p>
        ) : status.usage === 0 ? (
          <ConfirmButton
            label="Borrar estado"
            onConfirm={() => run(() => deleteStatus(status.id), { msg: "Estado borrado", onDone: onClose })}
          />
        ) : (
          <p className="text-[13px] text-muted">Se usa en {status.usage} día(s): no se puede borrar, solo desactivar.</p>
        )}
      </div>
    </div>
  );
}

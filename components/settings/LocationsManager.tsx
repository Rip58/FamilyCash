"use client";

import { useState } from "react";
import { deleteLocation, reorderLocations, saveLocation } from "@/app/actions/planograms";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import type { LocationOption } from "@/lib/planograms";
import { AddButton, BackHeader, ConfirmButton, Field, PrimaryButton, SortableList, TextInput, Toggle, inputClass, useRun } from "./kit";

export type LocationRow = LocationOption & { count: number };

/** Ubicaciones de los lineales (lineal PA, box…): se eligen al subir un lineal en Protocolos. */
export function LocationsManager({ locations }: { locations: LocationRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { run } = useRun();
  const editing = locations.find((l) => l.id === editingId) ?? null;

  return (
    <div>
      <BackHeader title="Ubicaciones" action={<AddButton label="Añadir" onClick={() => setCreating(true)} />} />
      <p className="mb-3 px-1 text-[13px] text-muted">
        Dónde están los lineales (lineal PA, box, cabecera…). Se eligen en Protocolos → Lineales. Arrastra para reordenar.
      </p>
      <div className="overflow-hidden rounded-card bg-surface">
        <SortableList
          items={locations}
          onReorder={(ids) => run(() => reorderLocations(ids), { msg: "Orden guardado" })}
          render={(l, handle) => (
            <div className={cn("flex items-center gap-1 border-b border-line bg-surface pr-2", !l.active && "opacity-60")}>
              {handle}
              <button
                type="button"
                onClick={() => setEditingId(l.id)}
                className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left"
              >
                <span className="truncate text-[17px]">
                  {l.name}
                  {!l.active && " (inactiva)"}
                </span>
                <span className="truncate text-[13px] text-muted">
                  {l.count === 0 ? "Sin lineales" : l.count === 1 ? "1 lineal" : `${l.count} lineales`}
                </span>
              </button>
              <span aria-hidden className="text-muted">›</span>
            </div>
          )}
        />
        {locations.length === 0 && <p className="p-6 text-center text-muted">Aún no hay ubicaciones.</p>}
      </div>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title="Nueva ubicación">
        {creating && <NewLocation onDone={() => setCreating(false)} />}
      </BottomSheet>
      <BottomSheet open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? "Ubicación"}>
        {editing && <EditLocation key={editing.id} location={editing} onClose={() => setEditingId(null)} />}
      </BottomSheet>
    </div>
  );
}

function NewLocation({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const { pending, run } = useRun();
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <input
          aria-label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          maxLength={80}
          placeholder="Ej.: Lineal PA"
          autoFocus
        />
      </Field>
      <PrimaryButton
        className="mt-2 w-full"
        disabled={pending || !name.trim()}
        onClick={() => run(() => saveLocation({ name, active: true }), { msg: "Ubicación añadida", onDone })}
      >
        Añadir ubicación
      </PrimaryButton>
    </div>
  );
}

function EditLocation({ location: initial, onClose }: { location: LocationRow; onClose: () => void }) {
  const [location, setLocation] = useState(initial);
  const { pending, run } = useRun();
  const save = (patch: Partial<LocationRow>) => {
    const next = { ...location, ...patch };
    setLocation(next);
    run(() => saveLocation({ id: next.id, name: next.name, active: next.active }));
  };
  return (
    <div className="pb-2">
      <Field label="Nombre">
        <TextInput label="Nombre" value={location.name} maxLength={80} onCommit={(v) => v.trim() && save({ name: v })} />
      </Field>
      <Toggle label="Activa" checked={location.active} onChange={(v) => save({ active: v })} disabled={pending} />
      <div className="mt-2">
        <ConfirmButton
          label="Borrar ubicación"
          onConfirm={() => run(() => deleteLocation(location.id), { msg: "Ubicación borrada", onDone: onClose })}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { saveRotaOrder } from "@/app/actions/settings";
import { SortableList } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { notify } from "@/components/ui/toast";

export interface RotaPerson {
  id: string;
  name: string;
  departmentName: string | null;
}

/**
 * Modo ordenar de la plantilla (orden del Excel): se arrastra con el asa y NO se guarda nada hasta
 * pulsar "Guardar", para evitar cambios por un toque sin querer.
 */
export default function RotaOrderSheet({ open, onClose, people }: { open: boolean; onClose: () => void; people: RotaPerson[] }) {
  const [list, setList] = useState(people);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const byId = new Map(people.map((p) => [p.id, p]));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
    setDirty(true);
  };

  function save() {
    start(async () => {
      const r = await saveRotaOrder(list.map((p) => p.id));
      if (r.ok) {
        notify("Orden guardado");
        onClose();
      } else notify(r.error, "error");
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Ordenar plantilla">
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[14px] text-muted">
          Mantén pulsado el asa ⠿ y arrastra, o usa ↑ ↓. Nada se guarda hasta que pulses <b>Guardar</b>.
        </p>
        <div className="overflow-hidden rounded-card bg-surface-2">
          <SortableList
            items={list}
            onReorder={(ids) => {
              setList(ids.map((id) => byId.get(id)!));
              setDirty(true);
            }}
            render={(p, handle, dragging) => {
              const i = list.findIndex((x) => x.id === p.id);
              return (
                <div className={cn("flex items-center gap-1 border-b border-line bg-surface-2 pr-1", dragging && "shadow-lg")}>
                  {handle}
                  <span className="w-6 shrink-0 text-right text-[13px] tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 px-2">
                    <span className="block truncate text-[16px]">{p.name}</span>
                    {p.departmentName && <span className="block truncate text-[12px] text-muted">{p.departmentName}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label={`Subir a ${p.name}`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex min-h-11 min-w-11 items-center justify-center text-[18px] text-accent disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Bajar a ${p.name}`}
                    disabled={i === list.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex min-h-11 min-w-11 items-center justify-center text-[18px] text-accent disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              );
            }}
          />
        </div>
        <div className="sticky bottom-0 flex gap-2 bg-surface pb-1 pt-2">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-control bg-surface-2 text-[16px] font-medium">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="min-h-12 flex-[2] rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
          >
            {pending ? "Guardando…" : "Guardar orden"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { normalize } from "@/lib/employee-history";

export interface PickerOption {
  key: string;
  name: string;
  href: string;
  group: "Notas" | "Departamentos" | "Empleados";
  /** Gris (p. ej. empleado de baja). */
  muted?: boolean;
  hint?: string;
}

/** Buscador del historial: todas las notas, las generales, un departamento o un empleado. */
export function EmployeePicker({ options, selectedKey }: { options: PickerOption[]; selectedKey: string | null }) {
  const router = useRouter();
  const selected = options.find((p) => p.key === selectedKey);
  const [open, setOpen] = useState(!selected);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const n = normalize(q.trim());
    const list = n ? options.filter((p) => normalize(p.name).includes(n)) : options;
    return (["Notas", "Departamentos", "Empleados"] as const)
      .map((g) => ({ g, items: list.filter((p) => p.group === g) }))
      .filter((x) => x.items.length > 0);
  }, [options, q]);

  if (!open && selected) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex min-h-11 w-full items-center justify-between gap-2 rounded-control bg-surface px-3 text-left"
      >
        <span className="truncate text-[17px] font-semibold">{selected.name}</span>
        <span className="shrink-0 text-[14px] text-accent">Cambiar</span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar empleado, departamento o «notas»…"
        aria-label="Buscar empleado"
        autoFocus={!selected}
        className="min-h-11 w-full border-b border-line bg-transparent px-3 text-[16px] outline-none"
      />
      <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
        {groups.map(({ g, items }) => (
          <section key={g}>
            <h3 className="bg-surface-2/60 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{g}</h3>
            <ul className="divide-y divide-line">
              {items.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      router.push(p.href);
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-[15px] active:bg-surface-2"
                  >
                    <span className={p.muted ? "text-muted" : ""}>{p.name}</span>
                    {p.hint && <span className="text-[12px] text-muted">{p.hint}</span>}
                    {p.key === selectedKey && <span className="text-[13px] text-accent">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="px-3 py-3 text-[14px] text-muted">Nada con ese nombre.</p>}
      </div>
    </div>
  );
}

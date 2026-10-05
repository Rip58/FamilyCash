"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { normalize } from "@/lib/employee-history";

interface Person {
  id: string;
  name: string;
  active: boolean;
}

/** Buscador de empleado: escribe y toca un nombre. */
export function EmployeePicker({ people, selectedId }: { people: Person[]; selectedId: string | null }) {
  const router = useRouter();
  const selected = people.find((p) => p.id === selectedId);
  const [open, setOpen] = useState(!selected);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = normalize(q.trim());
    return n ? people.filter((p) => normalize(p.name).includes(n)) : people;
  }, [people, q]);

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
        placeholder="Buscar empleado…"
        aria-label="Buscar empleado"
        autoFocus={!selected}
        className="min-h-11 w-full border-b border-line bg-transparent px-3 text-[16px] outline-none"
      />
      <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto overscroll-contain">
        {list.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQ("");
                router.push(`/informe/empleado?id=${p.id}`);
              }}
              className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-[15px] active:bg-surface-2"
            >
              <span className={p.active ? "" : "text-muted"}>{p.name}</span>
              {!p.active && <span className="text-[12px] text-muted">baja</span>}
              {p.id === selectedId && <span className="text-[13px] text-accent">✓</span>}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-3 text-[14px] text-muted">Nadie con ese nombre.</li>}
      </ul>
    </div>
  );
}

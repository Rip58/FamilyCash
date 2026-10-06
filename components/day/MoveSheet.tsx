"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import type { DepartmentLite } from "@/lib/schedule";
import { toggleDepartment } from "@/lib/segments";

interface MoveSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  departments: DepartmentLite[];
  /** Departamento efectivo actual (principal). */
  currentId: string | null;
  /** Otros departamentos que ya cubre esa noche. */
  extraIds?: string[];
  habitualId: string | null;
  /** `extras` = otros departamentos que también cubre (vacío = solo el principal). */
  onPick: (departmentId: string, extras: string[]) => void;
  /** Título alternativo (p. ej. tras pasar lista). */
  title?: string;
}

/**
 * Dónde trabaja hoy: tocar un departamento = solo ése (y cierra); la casilla de la derecha permite marcar
 * varios (un empleado puede cubrir varios departamentos pequeños en una noche) y luego Guardar.
 */
export function MoveSheet({ open, onClose, name, departments, currentId, extraIds = [], habitualId, onPick, title }: MoveSheetProps) {
  const [sel, setSel] = useState<{ main: string | null; extras: string[] }>({ main: currentId, extras: extraIds });
  const [prev, setPrev] = useState({ open, currentId, extraIds });
  if (open !== prev.open || currentId !== prev.currentId || extraIds !== prev.extraIds) {
    setPrev({ open, currentId, extraIds });
    setSel({ main: currentId, extras: extraIds });
  }
  const chosen = [...(sel.main ? [sel.main] : []), ...sel.extras];
  const changed =
    sel.main !== currentId || sel.extras.length !== extraIds.length || sel.extras.some((x, i) => x !== extraIds[i]);

  return (
    <BottomSheet open={open} onClose={onClose} title={title ?? `Mover a… · ${name}`}>
      <p className="mb-2 px-1 text-[13px] text-muted">Toca uno, o marca varios con ☐ si cubre más de un departamento.</p>
      {/* Dos columnas: caben todos los departamentos sin hacer scroll. */}
      <ul className="grid grid-cols-2 gap-1.5 pb-2">
        {departments.map((d) => {
          const on = chosen.includes(d.id);
          const isMain = chosen[0] === d.id;
          return (
            <li key={d.id} className={cn("flex min-w-0 items-stretch rounded-control bg-surface-2", on && "ring-2 ring-accent")}>
              <button
                type="button"
                onClick={() => {
                  onPick(d.id, []);
                  onClose();
                }}
                className="press flex min-h-12 min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 text-left text-[14px] leading-tight"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words">{d.name}</span>
                  {on && chosen.length > 1 && isMain && <span className="block text-[11px] text-muted">Principal</span>}
                  {d.id === currentId && !changed && chosen.length === 1 && <span className="block text-[11px] text-muted">Actual</span>}
                  {d.id === habitualId && d.id !== currentId && <span className="block text-[11px] text-muted">Habitual</span>}
                </span>
              </button>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`Marcar ${d.name} (varios departamentos)`}
                onClick={() => setSel((s) => toggleDepartment(s.main, s.extras, d.id))}
                className="flex w-10 shrink-0 items-center justify-center"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-[6px] border-2",
                    on ? "border-accent bg-accent text-white" : "border-line text-transparent",
                  )}
                >
                  <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {changed && chosen.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onPick(chosen[0]!, chosen.slice(1));
            onClose();
          }}
          className="mb-2 min-h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
        >
          Guardar · {chosen.length === 1 ? "1 departamento" : `${chosen.length} departamentos`}
        </button>
      )}
    </BottomSheet>
  );
}

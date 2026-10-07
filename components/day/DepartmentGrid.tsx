"use client";

import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";

/**
 * Departamentos en dos columnas (caben todos sin scroll): tocar el nombre = solo ése; la casilla de la derecha
 * marca varios (sin `onToggle`, solo uno). Es EL selector de departamento de la app: Hoy (⇄ y la ficha de la persona),
 * Ajustes (habitual y «También cubre») y las notas.
 */
export function DepartmentGrid({
  departments,
  chosen,
  currentId,
  habitualId,
  onPickOne,
  onToggle,
  none,
}: {
  departments: { id: string; name: string; color?: string | null; active?: boolean }[];
  /** Elegidos: el primero es el principal. */
  chosen: string[];
  /** Para la etiqueta «Actual» (cuando no se ha cambiado nada). */
  currentId?: string | null;
  habitualId?: string | null;
  onPickOne: (id: string) => void;
  onToggle?: (id: string) => void;
  /** Casilla «ninguno» (p. ej. «Sin asignar»), elegida cuando no hay ninguno. */
  none?: { label: string; onPick: () => void };
}) {
  return (
    <ul className="grid grid-cols-2 gap-1.5">
      {none && (
        <li className={cn("flex min-w-0 items-stretch rounded-control bg-surface-2", chosen.length === 0 && "ring-2 ring-accent")}>
          <button
            type="button"
            aria-pressed={chosen.length === 0}
            onClick={none.onPick}
            className="press flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 pl-2.5 text-left text-[14px] leading-tight text-muted"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-line" />
            <span className="line-clamp-2 break-words">{none.label}</span>
          </button>
        </li>
      )}
      {departments.map((d) => {
        const on = chosen.includes(d.id);
        const isMain = chosen[0] === d.id;
        return (
          <li key={d.id} className={cn("flex min-w-0 items-stretch rounded-control bg-surface-2", on && "ring-2 ring-accent")}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPickOne(d.id)}
              className={cn("press flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 pl-2.5 text-left text-[14px] leading-tight", !onToggle && "pr-2.5")}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color ?? "#64748b" }} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words">
                  {d.name}
                  {d.active === false && " (inactivo)"}
                </span>
                {on && chosen.length > 1 && isMain && <span className="block text-[11px] text-muted">Principal</span>}
                {currentId !== undefined && d.id === currentId && chosen.length === 1 && on && (
                  <span className="block text-[11px] text-muted">Actual</span>
                )}
                {d.id === habitualId && !on && <span className="block text-[11px] text-muted">Habitual</span>}
              </span>
            </button>
            {onToggle && (
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`Marcar ${d.name} (varios departamentos)`}
                onClick={() => onToggle(d.id)}
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
            )}
          </li>
        );
      })}
    </ul>
  );
}

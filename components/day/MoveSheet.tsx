"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DepartmentLite } from "@/lib/schedule";
import { toggleDepartment } from "@/lib/segments";
import { DepartmentGrid } from "./DepartmentGrid";

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
      <div className="pb-2">
        <DepartmentGrid
          departments={departments}
          chosen={chosen}
          currentId={changed ? null : currentId}
          habitualId={habitualId}
          onPickOne={(id) => {
            onPick(id, []);
            onClose();
          }}
          onToggle={(id) => setSel((s) => toggleDepartment(s.main, s.extras, id))}
        />
      </div>
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

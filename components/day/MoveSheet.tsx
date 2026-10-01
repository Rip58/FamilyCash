"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import type { DepartmentLite } from "@/lib/schedule";

interface MoveSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  departments: DepartmentLite[];
  /** Departamento efectivo actual. */
  currentId: string | null;
  habitualId: string | null;
  onPick: (departmentId: string) => void;
  /** Título alternativo (p. ej. tras pasar lista). */
  title?: string;
}

export function MoveSheet({ open, onClose, name, departments, currentId, habitualId, onPick, title }: MoveSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title ?? `Mover a… · ${name}`}>
      <ul className="flex flex-col gap-1 pb-2">
        {departments.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => {
                if (d.id !== currentId) onPick(d.id);
                onClose();
              }}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-control bg-surface-2 px-4 text-left text-[16px]",
                d.id === currentId && "ring-2 ring-accent",
              )}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="flex-1">{d.name}</span>
              {d.id === currentId && <span className="text-[13px] text-muted">Actual</span>}
              {d.id === habitualId && d.id !== currentId && <span className="text-[13px] text-muted">Habitual</span>}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

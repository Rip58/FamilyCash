"use client";

import { cn } from "@/components/ui/cn";
import type { StatusTypeLite } from "@/lib/schedule";

/** Estados como botones grandes separados, con su color (el elegido, relleno). */
export function StatusButtons({
  statuses,
  value,
  onPick,
}: {
  statuses: StatusTypeLite[];
  value?: string | null;
  onPick: (status: StatusTypeLite) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Estado">
      {statuses.map((s) => {
        const selected = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(s)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-2 rounded-card border-2 px-3 text-center text-[16px] font-semibold leading-tight active:opacity-70",
              selected && "text-white shadow-sm",
            )}
            style={{ borderColor: s.color, backgroundColor: selected ? s.color : `${s.color}1f` }}
          >
            {!selected && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />}
            {selected && <span aria-hidden>✓</span>}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

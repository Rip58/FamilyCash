"use client";

import { cn } from "@/components/ui/cn";
import { Icon, tint } from "@/components/ui/icons";
import type { StatusTypeLite } from "@/lib/schedule";

/** EL selector de estado de la app: 2 columnas compactas (6 estados = 3 filas), el elegido relleno con ✓ dentro. */
export function StatusButtons({
  statuses,
  value,
  onPick,
  extra,
}: {
  statuses: StatusTypeLite[];
  value?: string | null;
  onPick: (status: StatusTypeLite) => void;
  /** Opción más a lo ancho, al final (p. ej. «? · Dejar como está» al importar). */
  extra?: React.ReactNode;
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
              "press flex min-h-11 min-w-0 items-center gap-2 rounded-control border-2 px-2.5 text-left text-[15px] font-semibold leading-tight",
              selected && "text-white",
            )}
            style={{ borderColor: selected ? s.color : "transparent", backgroundColor: selected ? s.color : tint(s.color, 16) }}
          >
            {selected ? (
              <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={3} />
            ) : (
              <span className="mx-[3px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            )}
            <span className="min-w-0 truncate">{s.label}</span>
          </button>
        );
      })}
      {extra && <div className="col-span-2">{extra}</div>}
    </div>
  );
}

"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icons";

export interface ActionItem {
  icon: IconName;
  label: string;
  /** Texto pequeño a la derecha ("+1 h"). */
  hint?: ReactNode;
  /** Resaltado (p. ej. cierre de turno pendiente). */
  highlight?: boolean;
  onSelect: () => void;
}

/**
 * Un solo botón (⋯) que despliega varias acciones. Se cierra al elegir, al tocar fuera o con Escape.
 * Entra desde su esquina (escala 0,95 → 1 + opacidad, 150 ms ease-out); sin animación al cerrar.
 */
export function ActionMenu({ items, label, badge }: { items: ActionItem[]; label: string; badge?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "press relative flex h-11 w-11 items-center justify-center rounded-full text-accent [touch-action:manipulation]",
          open ? "bg-accent text-accent-fg" : "bg-accent/15",
        )}
      >
        <Icon name="more" className="h-[22px] w-[22px]" />
        {badge && !open && <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />}
      </button>
      {open && (
        <div
          role="menu"
          className="menu-pop absolute right-0 top-[calc(100%+6px)] z-40 w-60 overflow-hidden rounded-card bg-surface shadow-[0_8px_30px_rgb(0_0_0/0.35)] ring-1 ring-line"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 border-b border-line px-3.5 text-left text-[15px] last:border-b-0 active:bg-surface-2",
                it.highlight && "font-semibold text-accent",
              )}
            >
              <Icon name={it.icon} className="h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.hint && <span className="shrink-0 text-[13px] font-semibold tabular-nums text-accent">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

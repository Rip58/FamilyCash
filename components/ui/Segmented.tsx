"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "./cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Color (hex) del segmento cuando está seleccionado. */
  color?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
  /** Permite varias líneas (útil con muchos estados). */
  wrap?: boolean;
  /** Más bajo (44px en total con el marco). */
  compact?: boolean;
  /** Una sola fila que se desliza de lado si no caben (muchas opciones, p. ej. personas). */
  scroll?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  wrap,
  compact,
  scroll,
  className,
  ...aria
}: SegmentedProps<T>) {
  const name = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Al elegir (o al entrar), la opción elegida se ve entera.
  useEffect(() => {
    if (!scroll) return;
    // Solo de lado (scrollIntoView movería también la página).
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!box || !el) return;
    if (el.offsetLeft < box.scrollLeft) box.scrollLeft = el.offsetLeft - 4;
    else if (el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = el.offsetLeft + el.offsetWidth - box.clientWidth + 4;
  }, [scroll, value]);
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn(
        "flex gap-1 rounded-control bg-surface-2 p-1",
        wrap && "flex-wrap",
        scroll && "no-scrollbar overflow-x-auto overscroll-x-contain",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-[8px] px-3 font-medium transition-colors duration-150",
              scroll && "whitespace-nowrap",
              compact ? "min-h-9 text-[13px]" : "min-h-11 text-[14px]",
              selected ? "text-white shadow-sm" : "text-fg",
              selected && !o.color && "bg-accent",
            )}
            style={selected && o.color ? { backgroundColor: o.color } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

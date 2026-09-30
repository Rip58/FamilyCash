"use client";

import { useId } from "react";
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
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  wrap,
  className,
  ...aria
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn("flex gap-1 rounded-control bg-surface-2 p-1", wrap && "flex-wrap", className)}
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
              "min-h-11 flex-1 rounded-[8px] px-3 text-[14px] font-medium transition-colors duration-150",
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

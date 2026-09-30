import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  selected?: boolean;
  /** Color de acento (hex). Si se da, se usa como fondo al estar seleccionado. */
  color?: string;
  children: ReactNode;
}

/** Botón tipo píldora (≥ 44px de alto). Ideal para días L–D, secciones, filtros. */
export function Chip({ selected = false, color, className, children, style, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-medium",
        "transition-colors duration-150 disabled:opacity-40",
        selected ? "text-white" : "bg-surface-2 text-fg",
        selected && !color && "bg-accent",
        className,
      )}
      style={selected && color ? { backgroundColor: color, ...style } : style}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Etiqueta informativa pequeña, no interactiva. */
export function Tag({
  color = "#64748b",
  children,
  className,
}: {
  color?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white", className)}
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

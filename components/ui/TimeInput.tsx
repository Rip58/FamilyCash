"use client";

import { useId } from "react";
import { cn } from "./cn";

/** ¿Es una hora "HH:mm" válida (00:00–23:59)? */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

interface TimeInputProps {
  label?: string;
  /** "HH:mm" o "" si vacío. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Muestra un botón para vaciar el valor. */
  clearable?: boolean;
}

/** Selector de hora HH:mm (24 h). En iPhone abre la rueda nativa. */
export function TimeInput({ label, value, onChange, disabled, className, clearable }: TimeInputProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] text-muted">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="time"
          step={60}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full rounded-control bg-surface-2 px-3 text-[17px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        />
        {clearable && value && (
          <button
            type="button"
            aria-label="Borrar hora"
            onClick={() => onChange("")}
            className="min-h-11 min-w-11 rounded-control bg-surface-2 text-lg text-muted"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

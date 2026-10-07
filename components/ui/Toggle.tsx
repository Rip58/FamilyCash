"use client";

import { useId } from "react";
import { cn } from "./cn";

/** Interruptor (sí/no) de la app: ajustes y opciones de una pantalla. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1">
      <span id={id} className="text-[16px]">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-150 after:absolute after:-inset-x-1 after:-inset-y-[7px] after:content-[''] disabled:opacity-40",
          checked ? "bg-success" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform duration-200 ease-out",
            checked && "translate-x-[20px]",
          )}
        />
      </button>
    </div>
  );
}

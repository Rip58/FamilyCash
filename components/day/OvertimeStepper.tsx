"use client";

import { cn } from "@/components/ui/cn";
import { OVERTIME_MAX, OVERTIME_STEP, clampOvertime, formatOvertime } from "@/lib/overtime";

interface OvertimeStepperProps {
  minutes: number;
  onChange: (minutes: number) => void;
  /** Versión compacta para listas. */
  compact?: boolean;
  label: string;
  /** El valor es una propuesta aún sin guardar. */
  suggested?: boolean;
}

const btn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-surface-2 text-[22px] font-medium leading-none text-accent active:opacity-70 disabled:opacity-30";

/** Stepper −/valor/+ en pasos de 15 min. */
export function OvertimeStepper({ minutes, onChange, compact, label, suggested }: OvertimeStepperProps) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        aria-label={`Quitar ${OVERTIME_STEP} minutos`}
        disabled={minutes <= 0}
        onClick={() => onChange(clampOvertime(minutes - OVERTIME_STEP))}
      >
        −
      </button>
      <span
        className={cn(
          "text-center text-[16px] font-semibold tabular-nums",
          compact ? "min-w-[64px]" : "min-w-[92px]",
          minutes === 0 && "text-muted",
          suggested && "italic text-accent",
        )}
        aria-live="polite"
      >
        {minutes === 0 ? "0" : formatOvertime(minutes)}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`Añadir ${OVERTIME_STEP} minutos`}
        disabled={minutes >= OVERTIME_MAX}
        onClick={() => onChange(clampOvertime(minutes + OVERTIME_STEP))}
      >
        +
      </button>
    </div>
  );
}

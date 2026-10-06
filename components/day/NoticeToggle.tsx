"use client";

import { cn } from "@/components/ui/cn";

/** Falta: ¿ha avisado? Tocar la opción elegida la quita (sin indicar). */
export function NoticeToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opt = (v: boolean, label: string, on: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(value === v ? null : v)}
      className={cn(
        "press min-h-11 flex-1 rounded-control text-[15px] font-semibold",
        value === v ? on : "bg-surface-2 text-fg",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="¿Ha avisado?">
      <span className="text-[13px] font-medium text-muted">¿Ha avisado? (queda en su historial)</span>
      <div className="flex gap-2">
        {opt(true, "✓ Avisó", "bg-success text-white")}
        {opt(false, "✗ No avisó", "bg-danger text-white")}
      </div>
    </div>
  );
}

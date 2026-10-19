"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";

type Opt = { id: string; name: string };

/**
 * «¿Para quién?» de las notas: un campo que enseña a quién va la nota y abre una hoja con todas las personas en dos
 * columnas compactas (caben sin scroll). Tocar = marcar/desmarcar; se pueden elegir varias. Ninguna = General.
 */
export function PeoplePicker({ employees, value, onChange }: { employees: Opt[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const name = new Map(employees.map((e) => [e.id, e.name]));
  const chosen = value.filter((id) => name.has(id));

  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        aria-label={`Persona: ${chosen.length ? chosen.map((id) => name.get(id)).join(", ") : "General"}. Cambiar`}
        className="press flex min-h-11 w-full items-center gap-2 rounded-control bg-surface-2 px-3 py-1.5 text-left"
      >
        {chosen.length === 0 ? (
          <span className="flex-1 text-[16px] text-muted">General (nadie en concreto)</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {chosen.length > 1 && (
              <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-accent-fg">
                <Icon name="users" className="h-3.5 w-3.5" strokeWidth={2.2} />
                {chosen.length}
              </span>
            )}
            {chosen.map((id) => (
              <span key={id} className="max-w-full truncate rounded-full bg-accent/12 px-2 py-0.5 text-[14px] font-medium text-accent">
                {name.get(id)}
              </span>
            ))}
          </span>
        )}
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="¿Para quién?">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted">Toca para marcar. Puedes elegir varias personas.</p>
          <ul className="grid grid-cols-2 gap-1">
            <li className="col-span-2">
              <button
                type="button"
                aria-pressed={draft.length === 0}
                onClick={() => setDraft([])}
                className={cn(
                  "press flex min-h-11 w-full items-center gap-2 rounded-control bg-surface-2 px-2.5 text-left text-[14px]",
                  draft.length === 0 && "ring-2 ring-accent",
                )}
              >
                <Check on={draft.length === 0} />
                General (nadie en concreto)
              </button>
            </li>
            {employees.map((e) => {
              const on = draft.includes(e.id);
              return (
                <li key={e.id} className="min-w-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(e.id)}
                    className={cn(
                      "press flex min-h-11 w-full min-w-0 items-center gap-2 rounded-control px-2.5 text-left text-[14px] leading-tight",
                      on ? "bg-accent/12 font-medium text-accent ring-2 ring-accent" : "bg-surface-2",
                    )}
                  >
                    <Check on={on} />
                    <span className="line-clamp-2 min-w-0 break-words">{e.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-[calc(-16px-env(safe-area-inset-bottom))] -mx-4 border-t border-line bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="press flex min-h-12 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
            >
              {draft.length === 0 ? "Nota general" : draft.length === 1 ? "Listo · 1 persona" : `Listo · ${draft.length} personas`}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 text-[12px] font-bold",
        on ? "border-accent bg-accent text-white" : "border-line",
      )}
    >
      {on && "✓"}
    </span>
  );
}

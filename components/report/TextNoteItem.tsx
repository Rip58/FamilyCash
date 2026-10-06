"use client";

import { useState, useTransition } from "react";
import { setDayNote, setNote } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DateStr } from "@/lib/dates";

type Target = { kind: "day"; date: DateStr } | { kind: "employee"; date: DateStr; employeeId: string };

async function save(target: Target, text: string) {
  return target.kind === "day"
    ? setDayNote({ date: target.date, text })
    : setNote({ employeeId: target.employeeId, date: target.date, note: text.trim() ? text : null });
}

/**
 * Nota del día (la de Hoy → ⋯ → Nota del día) o nota de un empleado esa noche (su ficha en Hoy), vista en el
 * Informe: tocarla la edita y la × la borra. Se guardan en el mismo sitio que en Hoy.
 */
export function TextNoteItem({ target, who, text }: { target: Target; who: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (value: string, after: () => void) =>
    start(async () => {
      setError(null);
      const r = await save(target, value);
      if (r.ok) after();
      else setError(r.error);
    });
  return (
    <li className="flex items-start gap-1 py-2">
      <button
        type="button"
        aria-label={`Editar nota: ${who}`}
        onClick={() => {
          setDraft(text);
          setOpen(true);
        }}
        className="min-w-0 flex-1 rounded-control pt-0.5 text-left active:bg-surface-2"
      >
        <span className="block text-[13px] font-semibold text-muted">{who}</span>
        <p className="whitespace-pre-wrap">{text}</p>
      </button>
      {confirm ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("", () => setConfirm(false))}
          className="min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-danger"
        >
          ¿Borrar?
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Borrar nota: ${who}`}
          onClick={() => setConfirm(true)}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[18px] text-muted"
        >
          ×
        </button>
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={`Nota · ${who}`}>
        <div className="flex flex-col gap-3 pb-2">
          <textarea
            aria-label="Nota"
            value={draft}
            maxLength={target.kind === "day" ? 1000 : 500}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[140px] w-full rounded-control bg-surface-2 px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-accent"
          />
          {error && (
            <p role="alert" className="text-[14px] text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(draft, () => setOpen(false))}
            className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
          >
            {pending ? "Guardando…" : draft.trim() ? "Guardar cambios" : "Guardar (borra la nota)"}
          </button>
        </div>
      </BottomSheet>
    </li>
  );
}

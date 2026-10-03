"use client";

import { AutoText } from "./AutoText";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface DayNoteCardProps {
  note: string | null;
  onSave: (text: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Nota del día: se ve solo si hay texto; el botón para añadirla está en la barra de Hoy. */
export function DayNoteCard({ note, onSave, open, onOpenChange }: DayNoteCardProps) {
  return (
    <>
      {note && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="min-h-11 w-full rounded-card bg-surface px-3.5 py-2 text-left"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Nota del día</span>
          <span className="block whitespace-pre-wrap text-[14px] leading-snug">{note}</span>
        </button>
      )}
      <BottomSheet open={open} onClose={() => onOpenChange(false)} title="Nota del día">
        {open && (
          <div className="pb-2">
            <AutoText
              label="Nota general de la noche"
              value={note ?? ""}
              onSave={onSave}
              multiline
              maxLength={1000}
              placeholder="Avisos, incidencias, recordatorios…"
            />
          </div>
        )}
      </BottomSheet>
    </>
  );
}

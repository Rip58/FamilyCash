"use client";

import { useState } from "react";
import { AutoText } from "./AutoText";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface DayNoteCardProps {
  note: string | null;
  onSave: (text: string) => void;
}

export function DayNoteCard({ note, onSave }: DayNoteCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {note ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 w-full rounded-card border border-line bg-surface px-4 py-3 text-left"
        >
          <span className="block text-[12px] font-semibold uppercase tracking-wide text-muted">Nota del día</span>
          <span className="mt-1 block whitespace-pre-wrap text-[15px]">{note}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-full px-3 text-[14px] text-muted"
        >
          + Nota del día
        </button>
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Nota del día">
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

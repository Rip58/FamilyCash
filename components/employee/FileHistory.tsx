"use client";

import { useState } from "react";
import { EmployeeHistoryView } from "@/components/report/EmployeeHistoryView";
import type { HistoryItem } from "@/lib/employee-history";
import type { NoteView } from "@/lib/employee-file";
import { NoteSheet } from "./NoteSheet";
import { RequestSheet } from "./RequestSheet";

/**
 * Ficha → Historial: TODO lo que hay sobre el empleado (notas de cada noche y de la ficha, faltas, vacaciones y bajas,
 * horarios, horas extra, avisos y peticiones), con filtro por tipo. Las notas de ficha se editan desde aquí.
 */
export function FileHistory({
  employeeId,
  name,
  items,
  notes,
  currentYear,
}: {
  employeeId: string;
  name: string;
  items: HistoryItem[];
  notes: NoteView[];
  currentYear: number;
}) {
  const [note, setNote] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [request, setRequest] = useState(false);
  const editing = note.id ? (notes.find((n) => n.id === note.id) ?? null) : null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Historial</h2>
        <div className="flex">
          <button type="button" onClick={() => setNote({ open: true, id: null })} className="min-h-11 rounded-full px-3 text-[16px] font-semibold text-accent">
            + Nota
          </button>
          <button type="button" onClick={() => setRequest(true)} className="min-h-11 rounded-full px-3 text-[16px] font-semibold text-accent">
            + Petición
          </button>
        </div>
      </div>
      <EmployeeHistoryView
        name={name}
        items={items}
        currentYear={currentYear}
        onEditFileNote={(id) => setNote({ open: true, id })}
      />
      <NoteSheet open={note.open} onClose={() => setNote((s) => ({ ...s, open: false }))} employeeId={employeeId} note={editing} />
      <RequestSheet open={request} onClose={() => setRequest(false)} employeeId={employeeId} request={null} />
    </div>
  );
}

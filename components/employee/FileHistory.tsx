import { AddNoteButton } from "@/components/notes/NoteList";
import type { NoteOptions } from "@/components/notes/NoteSheet";
import { EmployeeHistoryView } from "@/components/report/EmployeeHistoryView";
import type { DateStr } from "@/lib/dates";
import type { HistoryItem } from "@/lib/employee-history";

/**
 * Ficha → Historial: TODO lo que hay sobre el empleado (notas, incidencias, conversaciones, peticiones, faltas,
 * vacaciones y bajas, horarios y horas extra), con filtro por tipo. Las notas se añaden y editan desde aquí.
 */
export function FileHistory({
  employeeId,
  name,
  items,
  today,
  noteOptions,
  currentYear,
}: {
  employeeId: string;
  name: string;
  items: HistoryItem[];
  today: DateStr;
  noteOptions: NoteOptions;
  currentYear: number;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Historial</h2>
        <AddNoteButton
          defaults={{ date: today, employeeId }}
          options={noteOptions}
          className="min-h-11 rounded-full px-3 text-[16px] font-semibold text-accent"
        >
          + Nota
        </AddNoteButton>
      </div>
      <EmployeeHistoryView name={name} items={items} currentYear={currentYear} noteOptions={noteOptions} />
    </div>
  );
}

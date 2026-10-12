"use client";

import { useState, useTransition } from "react";
import { deleteReminder, saveReminder } from "@/app/actions/reminders";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/ui/Chip";
import { Segmented } from "@/components/ui/Segmented";
import { TimeInput } from "@/components/ui/TimeInput";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { type DateStr, WEEKDAY_LETTERS, formatDayLong, isDateStr } from "@/lib/dates";
import { type ReminderView, describeReminder, nextOccurrence } from "@/lib/reminders";

const field = "w-full min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent";

/** Informe → Recordatorios: lista y hoja para crear o editar (texto, días de la semana o una fecha, y hora). */
export function RemindersManager({ reminders, today, now }: { reminders: ReminderView[]; today: DateStr; now: string }) {
  const [sheet, setSheet] = useState<{ open: boolean; reminder: ReminderView | null; n: number }>({ open: false, reminder: null, n: 0 });
  const open = (reminder: ReminderView | null) => setSheet((s) => ({ open: true, reminder, n: s.n + 1 }));
  return (
    <div className="space-y-3">
      <p className="px-1 text-[14px] text-muted">
        Al abrir la app (o volver a ella) a partir del día y la hora que pongas, sale el aviso hasta que lo marques como hecho.
      </p>
      {reminders.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-8 text-center text-[15px] text-muted">Todavía no hay recordatorios.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
          {reminders.map((r) => {
            const next = nextOccurrence(r, today, now);
            return (
              <li key={r.id}>
                <button type="button" onClick={() => open(r)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2">
                  <Icon name="bell" className={cn("h-5 w-5 shrink-0", r.active ? "text-accent" : "text-muted")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[16px] leading-snug", !r.active && "text-muted line-through")}>{r.text}</span>
                    <span className="block text-[13px] text-muted">
                      {describeReminder(r)}
                      {!r.active ? " · desactivado" : next
                          ? ` · próximo: ${formatDayLong(next).toLowerCase()}`
                          : r.lastDone
                            ? " · hecho"
                            : " · pendiente de avisar"}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={() => open(null)}
        className="press flex min-h-12 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
      >
        + Nuevo recordatorio
      </button>
      <BottomSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        title={sheet.reminder ? "Editar recordatorio" : "Nuevo recordatorio"}
      >
        {sheet.open && (
          <ReminderForm key={sheet.n} reminder={sheet.reminder} today={today} onDone={() => setSheet((s) => ({ ...s, open: false }))} />
        )}
      </BottomSheet>
    </div>
  );
}

function ReminderForm({ reminder, today, onDone }: { reminder: ReminderView | null; today: DateStr; onDone: () => void }) {
  const [text, setText] = useState(reminder?.text ?? "");
  const [mode, setMode] = useState<"week" | "once">(reminder && reminder.weekdays.length === 0 ? "once" : "week");
  const [days, setDays] = useState<number[]>(reminder?.weekdays ?? []);
  const [date, setDate] = useState<string>(reminder?.date ?? today);
  const [time, setTime] = useState(reminder?.time ?? "22:00");
  const [active, setActive] = useState(reminder?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const valid = text.trim() && time && (mode === "week" ? days.length > 0 : isDateStr(date));
  const preview = valid ? describeReminder({ weekdays: mode === "week" ? days : [], date: mode === "once" ? (date as DateStr) : null, time }) : null;

  return (
    <div className="flex flex-col gap-4 pb-2">
      {error && (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Qué hay que recordar</span>
        <textarea
          aria-label="Recordatorio"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: imprimir los horarios para firmar"
          className={`${field} min-h-[88px] py-2`}
        />
      </label>
      <Segmented
        aria-label="Cuándo"
        value={mode}
        onChange={setMode}
        options={[
          { value: "week", label: "Cada semana" },
          { value: "once", label: "Un día" },
        ]}
      />
      {mode === "week" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Días</span>
          <div className="flex justify-between gap-1" role="group" aria-label="Días de la semana">
            {WEEKDAY_LETTERS.map((l, i) => (
              <Chip
                key={l}
                selected={days.includes(i)}
                onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
                className="px-0"
              >
                {l}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Día</span>
          <input type="date" aria-label="Día" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
      )}
      <TimeInput label="Hora del aviso" value={time} onChange={setTime} />
      {reminder && (
        <div className="rounded-control bg-surface-2 px-3">
          <Toggle checked={active} onChange={setActive} label="Activo" />
        </div>
      )}
      {preview && <p className="text-[14px] text-muted">Avisará: {preview.charAt(0).toLowerCase() + preview.slice(1)}.</p>}
      <button
        type="button"
        disabled={!valid || pending}
        onClick={() =>
          start(async () => {
            const r = await saveReminder({
              id: reminder?.id,
              text,
              weekdays: mode === "week" ? days : [],
              date: mode === "once" ? date : null,
              time,
              active,
            });
            if (r.ok) {
              notify(reminder ? "Recordatorio guardado" : "Recordatorio creado");
              onDone();
            } else setError(r.error);
          })
        }
        className="press min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {reminder &&
        (confirmDelete ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-control bg-surface-2 text-[15px] font-medium">
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteReminder(reminder.id);
                  if (r.ok) {
                    notify("Recordatorio borrado");
                    onDone();
                  } else setError(r.error);
                })
              }
              className="min-h-11 rounded-control bg-danger text-[15px] font-semibold text-white"
            >
              Sí, borrar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-[15px] font-medium text-danger">
            Borrar recordatorio
          </button>
        ))}
    </div>
  );
}

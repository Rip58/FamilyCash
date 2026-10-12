/** Lectura de recordatorios (solo servidor). */
import { db } from "./db";
import { fromDbDate } from "./dates";
import type { ReminderView } from "./reminders";

type Row = Awaited<ReturnType<typeof db.reminder.findMany>>[number];

export function toReminderView(r: Row): ReminderView {
  return {
    id: r.id,
    text: r.text,
    weekdays: [...r.weekdays].sort((a, b) => a - b),
    date: r.date ? fromDbDate(r.date) : null,
    time: r.time,
    active: r.active,
    lastDone: r.lastDone,
    snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
  };
}

export async function listReminders(): Promise<ReminderView[]> {
  const rows = await db.reminder.findMany({ orderBy: [{ time: "asc" }, { createdAt: "asc" }] });
  return rows.map(toReminderView);
}

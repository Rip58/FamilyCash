"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getDueReminders, markReminderDone, snoozeReminder } from "@/app/actions/reminders";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { describeReminder, type ReminderView } from "@/lib/reminders";

type Due = { reminder: ReminderView; occurrence: string };

const CHECK_EVERY_MS = 5 * 60_000;

/**
 * Aviso de recordatorios (Informe → 🔔): al abrir la app, al volver a ella y cada 5 min pregunta si toca alguno y
 * lo muestra en una hoja hasta que se marca «Hecho» o se aplaza. No son notificaciones del sistema.
 */
export function ReminderAlert() {
  const [due, setDue] = useState<Due[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const check = useCallback(async () => {
    try {
      const list = await getDueReminders();
      setDue(list);
      if (list.length > 0) setOpen(true);
    } catch {
      // Sin conexión: ya se mirará la próxima vez.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta al servidor al montar
    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [check]);

  function finish(id: string, action: () => Promise<{ ok: boolean }>, message: string) {
    start(async () => {
      const r = await action().catch(() => ({ ok: false }));
      if (!r.ok) {
        notify("No se pudo guardar. Inténtalo de nuevo.", "error");
        return;
      }
      notify(message);
      const rest = due.filter((d) => d.reminder.id !== id);
      setDue(rest);
      if (rest.length === 0) setOpen(false);
    });
  }

  return (
    <BottomSheet open={open && due.length > 0} onClose={() => setOpen(false)} title="Recordatorio">
      <ul className="flex flex-col gap-3 pb-2">
        {due.map(({ reminder: r, occurrence }) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                <Icon name="bell" className="h-[22px] w-[22px]" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-[17px] font-semibold leading-snug">{r.text}</p>
                <p className="mt-0.5 text-[13px] text-muted">{describeReminder(r)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => finish(r.id, () => snoozeReminder({ id: r.id, minutes: 60 }), "Te lo recordará en 1 h")}
                className="press min-h-11 rounded-control bg-surface text-[15px] font-medium disabled:opacity-40"
              >
                En 1 hora
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => finish(r.id, () => markReminderDone({ id: r.id, occurrence }), "Hecho")}
                className="press min-h-11 rounded-control bg-accent text-[15px] font-semibold text-accent-fg disabled:opacity-40"
              >
                Hecho
              </button>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

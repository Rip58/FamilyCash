import { Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { type DateStr, formatDayShort } from "@/lib/dates";
import { noteWho } from "@/lib/report";
import { TaskCheck } from "./ReportAdd";

interface TaskView {
  id: string;
  date: DateStr;
  name: string | null;
  department: string | null;
  done: boolean;
  text: string;
}

/** Tareas de la semana (y pendientes de semanas anteriores) con casilla de hecho. */
export function WeekTasks({ tasks, weekStart }: { tasks: TaskView[]; weekStart: DateStr }) {
  if (tasks.length === 0) return null;
  const pending = tasks.filter((t) => !t.done).length;
  return (
    <Card
      title="Tareas"
      action={
        <span className={cn("text-[13px] font-semibold", pending > 0 ? "text-warning" : "text-success")}>
          {pending > 0 ? `${pending} pendiente${pending === 1 ? "" : "s"}` : "Todo hecho"}
        </span>
      }
    >
      <ul className="divide-y divide-line">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-1 py-1.5">
            <TaskCheck id={t.id} done={t.done} label={t.text} />
            <div className="min-w-0 flex-1 pt-1.5">
              <span className="text-[12px] font-semibold text-muted">
                {formatDayShort(t.date)}
                {t.date < weekStart && <span className="text-warning"> · semana anterior</span>} · {noteWho(t)}
              </span>
              <p className={cn("whitespace-pre-wrap text-[15px]", t.done && "text-muted line-through")}>{t.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

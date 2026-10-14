"use client";

import { useState, useTransition } from "react";
import { deleteMeetingTopic, saveMeetingTopic, setMeetingTopicDone } from "@/app/actions/meetings";
import { DepartmentGrid } from "@/components/day/DepartmentGrid";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/components/ui/cn";
import { notify } from "@/components/ui/toast";
import { type DateStr, formatDayLong, formatDayMonth, isDateStr } from "@/lib/dates";
import {
  MAX_MEETING_TEXT,
  type MeetingTopicView,
  groupTopicsByWho,
  pastMeetings,
  pastWhoOptions,
} from "@/lib/meetings";
import { ProtocolsHeader, useCleanNewParam } from "./ProtocolTabs";

type Opt = { id: string; name: string; color?: string | null };

const field = "w-full min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent";
const label = "text-[13px] font-medium text-muted";

/**
 * Protocolos → Reuniones: temas pendientes para la próxima reunión (juntos por persona/departamento/general; casilla =
 * tratado hoy) y reuniones pasadas por fecha, con un selector que solo muestra a quién se ha tratado algo.
 */
export function MeetingBoard({
  topics,
  employees,
  departments,
  today,
  startCreating = false,
}: {
  topics: MeetingTopicView[];
  employees: Opt[];
  departments: Opt[];
  today: DateStr;
  startCreating?: boolean;
}) {
  const [sheet, setSheet] = useState<{ open: boolean; topic: MeetingTopicView | null; n: number }>({
    open: startCreating,
    topic: null,
    n: 0,
  });
  useCleanNewParam(startCreating);
  const [who, setWho] = useState<string | null>(null);
  const open = (topic: MeetingTopicView | null) => setSheet((s) => ({ open: true, topic, n: s.n + 1 }));

  const pending = groupTopicsByWho(topics.filter((t) => !t.doneOn));
  const whoOptions = pastWhoOptions(topics);
  const filter = who && whoOptions.some((o) => o.key === who) ? who : null;
  const past = pastMeetings(topics, filter);

  return (
    <div className="pb-6">
      <ProtocolsHeader active="reuniones" onNew={() => open(null)} />

      <h2 className="mt-4 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Para la próxima reunión</h2>
      {pending.length === 0 ? (
        <div className="mt-2 flex flex-col items-center gap-2 rounded-card bg-surface px-6 py-8 text-center">
          <p className="text-[15px] text-muted">No hay temas pendientes.</p>
          <button type="button" onClick={() => open(null)} className="min-h-11 text-[15px] font-semibold text-accent">
            + Apuntar un tema
          </button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface px-4">
          {pending.map((g) => (
            <li key={g.key} className="py-1.5">
              <h3 className="pt-1 text-[12px] font-semibold leading-tight text-fg/80">
                {g.label}
                {g.topics.length > 1 && <span className="font-normal text-muted"> · {g.topics.length}</span>}
              </h3>
              <ul>
                {g.topics.map((t) => (
                  <li key={t.id} className="flex items-start gap-1">
                    <DoneCheck topic={t} />
                    <button type="button" onClick={() => open(t)} className="min-w-0 flex-1 rounded-control py-2 text-left active:bg-surface-2">
                      <span className="block whitespace-pre-wrap break-words text-[15px] leading-snug">{t.text}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        Apuntado el {formatDayMonth(t.createdOn)}
                        {t.employeeId && t.departmentName ? ` · ${t.departmentName}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Reuniones pasadas</h2>
      {whoOptions.length === 0 ? (
        <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[15px] text-muted">
          Al marcar un tema como tratado, la reunión de ese día sale aquí.
        </p>
      ) : (
        <>
          <div role="group" aria-label="Filtrar reuniones" className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            {[{ key: null as string | null, label: "Todas" }, ...whoOptions].map((o) => (
              <button
                key={o.key ?? "all"}
                type="button"
                aria-pressed={filter === o.key}
                onClick={() => setWho(o.key)}
                className={cn(
                  "press min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold",
                  filter === o.key ? "bg-fg text-bg" : "bg-surface text-muted",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {past.map((m, i) => (
              <li key={m.date}>
                <details open={i === 0} className="group overflow-hidden rounded-card bg-surface">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold">{formatDayLong(m.date)}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {m.topics.length} {m.topics.length === 1 ? "tema" : "temas"} · {groupTopicsByWho(m.topics).map((g) => g.label).join(", ")}
                      </span>
                    </span>
                    <span aria-hidden className="text-muted transition-transform duration-150 group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <ul className="divide-y divide-line border-t border-line px-4">
                    {groupTopicsByWho(m.topics).map((g) => (
                      <li key={g.key} className="py-1.5">
                        <h3 className="pt-1 text-[12px] font-semibold leading-tight text-fg/80">{g.label}</h3>
                        <ul>
                          {g.topics.map((t) => (
                            <li key={t.id}>
                              <button type="button" onClick={() => open(t)} className="block w-full rounded-control py-2 text-left active:bg-surface-2">
                                <span className="block whitespace-pre-wrap break-words text-[15px] leading-snug">{t.text}</span>
                                {t.outcome && (
                                  <span className="mt-1 block whitespace-pre-wrap break-words rounded-control bg-surface-2 px-2.5 py-1.5 text-[14px] leading-snug">
                                    <span className="font-semibold text-muted">Valoración: </span>
                                    {t.outcome}
                                  </span>
                                )}
                                <span className="mt-0.5 block text-[12px] text-muted">Apuntado el {formatDayMonth(t.createdOn)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <BottomSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        title={sheet.topic ? "Tema de reunión" : "Nuevo tema"}
      >
        {sheet.open && (
          <TopicForm
            key={`${sheet.topic?.id ?? "new"}-${sheet.n}`}
            topic={sheet.topic}
            employees={employees}
            departments={departments}
            today={today}
            onDone={() => setSheet((s) => ({ ...s, open: false }))}
          />
        )}
      </BottomSheet>
    </div>
  );
}

/** Casilla: tratado hoy. */
function DoneCheck({ topic }: { topic: MeetingTopicView }) {
  const [on, setOn] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`Tratado hoy: ${topic.text}`}
      disabled={pending}
      onClick={() => {
        setOn(true);
        start(async () => {
          const r = await setMeetingTopicDone({ id: topic.id, done: true }).catch(() => ({ ok: false as const, error: "" }));
          if (r.ok) notify("Tratado hoy: pasa a la reunión de hoy");
          else {
            setOn(false);
            notify("No se pudo guardar. Inténtalo de nuevo.", "error");
          }
        });
      }}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-[7px] border-2 text-[14px] font-bold transition-colors duration-150",
          on ? "border-success bg-success text-white" : "border-line",
        )}
      >
        {on && "✓"}
      </span>
    </button>
  );
}

/** Si la persona/departamento ya no está en la lista (inactivo), se añade para no perderlo al guardar. */
function withCurrent(list: Opt[], id: string | null, name: string | null): Opt[] {
  return id && !list.some((o) => o.id === id) ? [{ id, name: name ?? "(ya no está)" }, ...list] : list;
}

function TopicForm({
  topic,
  employees,
  departments,
  today,
  onDone,
}: {
  topic: MeetingTopicView | null;
  employees: Opt[];
  departments: Opt[];
  today: DateStr;
  onDone: () => void;
}) {
  const [text, setText] = useState(topic?.text ?? "");
  const [employeeId, setEmployeeId] = useState(topic?.employeeId ?? "");
  const [departmentId, setDepartmentId] = useState(topic?.departmentId ?? "");
  const [done, setDone] = useState(!!topic?.doneOn);
  const [doneOn, setDoneOn] = useState<string>(topic?.doneOn ?? today);
  const [outcome, setOutcome] = useState(topic?.outcome ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const people = withCurrent(employees, topic?.employeeId ?? null, topic?.employeeName ?? null);
  const deps = withCurrent(departments, topic?.departmentId ?? null, topic?.departmentName ?? null);
  const canSave = !pending && text.trim().length > 0 && (!done || isDateStr(doneOn));

  function save() {
    setError(null);
    start(async () => {
      try {
        const r = await saveMeetingTopic({
          id: topic?.id,
          text,
          employeeId: employeeId || null,
          departmentId: departmentId || null,
          doneOn: done ? doneOn : null,
          outcome: done ? outcome : null,
        });
        if (r.ok) {
          notify(topic ? "Tema guardado" : "Tema apuntado");
          onDone();
        } else setError(r.error);
      } catch {
        setError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      {error && (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className={label}>Tema a tratar</span>
        <textarea
          aria-label="Tema"
          value={text}
          maxLength={MAX_MEETING_TEXT}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: recordar que hay que firmar los horarios…"
          className={`${field} min-h-[100px] py-2`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={label}>Persona</span>
        <select aria-label="Persona" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={field}>
          <option value="">Nadie en concreto</option>
          {people.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Departamento</span>
        <DepartmentGrid
          departments={deps}
          chosen={departmentId ? [departmentId] : []}
          onPickOne={setDepartmentId}
          none={{ label: "General", onPick: () => setDepartmentId("") }}
        />
      </div>

      <div className="rounded-control bg-surface-2 px-3">
        <Toggle checked={done} onChange={setDone} label="Tratado en la reunión" />
      </div>
      {done && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Día de la reunión</span>
            <input type="date" aria-label="Día de la reunión" value={doneOn} onChange={(e) => setDoneOn(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Valoración (opcional)</span>
            <textarea
              aria-label="Valoración"
              value={outcome}
              maxLength={MAX_MEETING_TEXT}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="¿Qué se habló o acordó? ¿Algo a valorar?"
              className={`${field} min-h-[90px] py-2`}
            />
          </label>
        </>
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className="press min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : topic ? "Guardar cambios" : "Apuntar tema"}
      </button>

      {topic &&
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
                  const r = await deleteMeetingTopic(topic.id);
                  if (r.ok) {
                    notify("Tema borrado");
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
            Borrar tema
          </button>
        ))}
    </div>
  );
}

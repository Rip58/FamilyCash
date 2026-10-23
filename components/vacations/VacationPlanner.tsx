"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { leaveVacation } from "@/app/actions/auth";
import { markVacationMessagesSeen, replyVacationMessage, signVacations, submitVacations } from "@/app/actions/vacations";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { notify } from "@/components/ui/toast";
import { type DateStr, MONTH_LONG, addDays, formatDayMonth, weekStart, weekdayIndex } from "@/lib/dates";
import {
  VACATION_STATUS_LABEL,
  type VacationRange,
  checkVacations,
  countedDays,
  rangeLabel,
  vacationSpan,
} from "@/lib/vacations";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

type Period = VacationRange & { status?: string };

const same = (a: Period[], b: Period[]) =>
  a.length === b.length && a.every((p, i) => p.start === b[i]!.start && p.end === b[i]!.end);
const sortRanges = (ps: Period[]) => [...ps].sort((a, b) => (a.start < b.start ? -1 : 1));

/**
 * Página de vacaciones del empleado: calendario del año, toca el primer día y el último para marcar un periodo (sus
 * 2 días de fiesta se añaden solos), contador «X de 22» y «Enviar a mi encargado» (sin firma). Cuando el encargado se lo
 * aprueba todo, «Firmar»: la firma queda con las fechas en su ficha. Cada cambio aprobado se vuelve a firmar.
 * Solo ve sus días y las semanas bloqueadas; nada de los demás.
 */
export function VacationPlanner({
  name,
  year,
  workDays,
  deadline,
  editable,
  blocked,
  periods: saved,
  signedAt,
  signedRanges,
  pendingSignature,
  messages,
  unseen,
}: {
  name: string;
  year: number;
  workDays: number;
  deadline: DateStr;
  editable: boolean;
  blocked: { weekStart: DateStr; reason: string | null }[];
  periods: Period[];
  signedAt: string | null;
  signedRanges: VacationRange[];
  pendingSignature: boolean;
  messages: { id: string; fromOwner: boolean; text: string; at: string }[];
  unseen: number;
}) {
  const router = useRouter();
  // Lo que pidió quitar (y aún está en el planning) va aparte: no cuenta ni se pinta en el calendario.
  const live = useMemo(() => saved.filter((p) => p.status !== "CANCEL"), [saved]);
  const cancels = saved.filter((p) => p.status === "CANCEL");
  const [periods, setPeriods] = useState<Period[]>(live);
  const [sending, setSending] = useState(false);
  const [first, setFirst] = useState<DateStr | null>(null);
  const [removing, setRemoving] = useState<{ index: number; open: boolean } | null>(null);
  const [signing, setSigning] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [pending, start] = useTransition();
  const pad = useRef<SignaturePadHandle>(null);
  const [reply, setReply] = useState("");
  const chatRef = useRef<HTMLElement>(null);
  // Al entrar, lo que te ha escrito el encargado queda leído (el aviso de arriba se ve igualmente esta vez).
  useEffect(() => {
    if (unseen > 0) void markVacationMessagesSeen().catch(() => undefined);
  }, [unseen]);

  // Al guardar, el servidor manda los periodos nuevos: se vuelve a partir de ellos.
  const [prevSaved, setPrevSaved] = useState(live);
  if (live !== prevSaved) {
    setPrevSaved(live);
    setPeriods(live);
  }

  const blockedMap = useMemo(() => new Map(blocked.map((b) => [b.weekStart, b.reason])), [blocked]);
  const blockedSet = useMemo(() => new Set(blocked.map((b) => b.weekStart)), [blocked]);
  const dirty = !same(sortRanges(periods), sortRanges(live));
  const waiting = !dirty && live.some((p) => p.status === "SENT" || p.status === "REVIEW");
  const used = countedDays(periods);
  const left = workDays - used;

  // Qué es cada día: descuenta / su fiesta, y de qué periodo.
  const dayInfo = useMemo(() => {
    const m = new Map<DateStr, { kind: "work" | "fiesta"; index: number }>();
    periods.forEach((p, index) => vacationSpan(p).days.forEach((d) => m.set(d.date, { kind: d.kind, index })));
    return m;
  }, [periods]);

  const rules = { year, workDays, blocked: blockedSet };

  function tap(date: DateStr) {
    if (!editable) return;
    const own = dayInfo.get(date);
    if (own) {
      setFirst(null);
      setRemoving({ index: own.index, open: true });
      return;
    }
    if (blockedSet.has(weekStart(date))) {
      notify(`Esa semana no se puede${blockedMap.get(weekStart(date)) ? `: ${blockedMap.get(weekStart(date))}` : ""}.`, "error");
      return;
    }
    if (!first) {
      setFirst(date);
      return;
    }
    const range = first <= date ? { start: first, end: date } : { start: date, end: first };
    setFirst(null);
    const next = sortRanges([...periods, range]);
    const err = checkVacations(next, rules);
    if (err) {
      notify(err, "error");
      return;
    }
    setPeriods(next);
  }

  function send() {
    start(async () => {
      const r = await submitVacations({ periods: periods.map(({ start, end }) => ({ start, end })) }).catch(() => ({
        ok: false as const,
        error: "Sin conexión. Inténtalo de nuevo.",
      }));
      if (r.ok) {
        notify("Enviado a tu encargado");
        setSending(false);
        router.refresh();
      } else notify(r.error, "error");
    });
  }

  function sign() {
    const signature = pad.current?.toDataUrl();
    if (!signature) {
      notify("Firma en el recuadro con el dedo.", "error");
      return;
    }
    start(async () => {
      const r = await signVacations({ signature }).catch(() => ({ ok: false as const, error: "Sin conexión. Inténtalo de nuevo." }));
      if (r.ok) {
        notify("Vacaciones firmadas");
        setSigning(false);
        router.refresh();
      } else notify(r.error, "error");
    });
  }

  const [dy, dm, dd] = deadline.split("-");
  const deadlineText = `${Number(dd)}/${Number(dm)}/${dy}`;
  const firstName = name.split(/\s+/)[0] ?? name;
  const removingPeriod = removing ? periods[removing.index] : null;

  return (
    <div className="flex flex-col gap-3 pb-32">
      <header className="flex items-center justify-between gap-3 pt-5">
        <h1 className="text-[26px] font-bold tracking-tight">Hola, {firstName}</h1>
        <button
          type="button"
          onClick={() => start(async () => void (await leaveVacation(), router.refresh()))}
          className="min-h-11 rounded-full bg-surface-2 px-4 text-[15px] font-medium text-accent"
        >
          Salir
        </button>
      </header>

      {unseen > 0 && (
        <button
          type="button"
          onClick={() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="rounded-card bg-warning/15 px-4 py-3 text-left text-[15px] font-medium text-[#8a4b00]"
        >
          Tu encargado te ha escrito ({unseen}). Toca para leerlo.
        </button>
      )}

      {pendingSignature && !dirty && (
        <section className="flex flex-col gap-2 rounded-card bg-success/12 px-4 py-3">
          <p className="text-[15px] font-medium text-[#15803d]">
            Tu encargado ha aprobado tus vacaciones. Fírmalas para que queden guardadas en tu ficha.
          </p>
          <button
            type="button"
            onClick={() => setSigning(true)}
            className="press min-h-11 rounded-control bg-[#16a34a] text-[16px] font-semibold text-white"
          >
            Firmar mis vacaciones
          </button>
        </section>
      )}

      <section aria-label="Tus días" className="rounded-card bg-surface px-4 py-3">
        <p className="text-[15px]">
          <b className="text-[24px] tabular-nums">{used}</b> de {workDays} días laborables
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.min(100, (used / workDays) * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          {left > 0 ? `Te quedan ${left}` : "Ya has elegido todos"} · plazo hasta el {deadlineText}
        </p>
      </section>

      {!editable && (
        <p role="status" className="rounded-card bg-warning/12 px-4 py-3 text-[14px] font-medium text-[#8a4b00]">
          Las vacaciones están cerradas. Si necesitas cambiar algo, habla con tu encargado.
        </p>
      )}

      {editable && (
        <p className="rounded-card bg-accent/10 px-4 py-2.5 text-[14px] text-accent" aria-live="polite">
          {first
            ? `Desde el ${formatDayMonth(first)}: ahora toca el último día.`
            : "Toca el primer día y luego el último. Tus 2 días de fiesta se añaden solos y no descuentan."}
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-muted">
        <Legend className="bg-[#3b82f6]" label="Descuenta" />
        <Legend className="bg-[#bfdbfe]" label="Tu fiesta (no cuenta)" />
        <Legend className="vac-blocked" label="No se puede" />
      </div>

      {MONTH_LONG.map((label, m) => (
        <Month
          key={label}
          year={year}
          month={m}
          label={label}
          dayInfo={dayInfo}
          blocked={blockedSet}
          first={first}
          editable={editable}
          onTap={tap}
        />
      ))}

      {blocked.some((b) => b.reason) && (
        <section className="rounded-card bg-surface px-4 py-3 text-[14px]">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Semanas que no se pueden</h2>
          <ul className="flex flex-col gap-0.5">
            {blocked.map((b) => (
              <li key={b.weekStart}>
                {formatDayMonth(b.weekStart)} – {formatDayMonth(addDays(b.weekStart, 6))}
                {b.reason && <span className="text-muted"> · {b.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Mis vacaciones" className="overflow-hidden rounded-card bg-surface">
        <h2 className="px-4 pb-1 pt-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Mis vacaciones {year}</h2>
        {periods.length === 0 && cancels.length === 0 ? (
          <p className="px-4 pb-3 text-[15px] text-muted">Todavía no has elegido nada.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sortRanges(periods).map((p) => {
              const s = vacationSpan(p);
              const status = !dirty || saved.some((x) => x.start === p.start && x.end === p.end) ? p.status : undefined;
              return (
                <li key={`${p.start}${p.end}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <b className="block text-[16px]">{rangeLabel(p)}</b>
                    <span className="text-[13px] text-muted">
                      {s.days.length} días · descuenta {s.counted}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold",
                      status === "OK" || status === "APPLIED"
                        ? "bg-success/15 text-[#15803d]"
                        : status === "REVIEW"
                          ? "bg-warning/15 text-[#b45309]"
                          : status
                            ? "bg-surface-2 text-muted"
                            : "bg-accent/12 text-accent",
                    )}
                  >
                    {status ? (VACATION_STATUS_LABEL[status] ?? status) : "Sin enviar"}
                  </span>
                </li>
              );
            })}
            {cancels.map((p) => (
              <li key={`c${p.start}${p.end}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <b className="block text-[16px] text-muted line-through">{rangeLabel(p)}</b>
                  <span className="text-[13px] text-muted">Pides quitarlo: tu encargado tiene que aceptarlo</span>
                </span>
                <span className="shrink-0 rounded-md bg-warning/15 px-2 py-0.5 text-[12px] font-semibold text-[#b45309]">Pendiente</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {signedAt && signedRanges.length > 0 && (
        <section aria-label="Vacaciones firmadas" className="rounded-card bg-surface px-4 py-3">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Vacaciones firmadas</h2>
          <ul className="flex flex-col gap-0.5 text-[15px]">
            {signedRanges.map((r) => (
              <li key={`${r.start}${r.end}`}>
                <b>{rangeLabel(r)}</b> · descuenta {vacationSpan(r).counted}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[13px] text-muted">Firmadas el {signedAt}</p>
        </section>
      )}

      <section ref={chatRef} aria-label="Mensajes" className="flex scroll-mt-4 flex-col gap-2 rounded-card bg-surface p-3">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Mensajes con tu encargado</h2>
        {messages.length === 0 && <p className="px-1 text-[14px] text-muted">Si necesitas explicar algo, escríbelo aquí.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-[15px]",
              m.fromOwner ? "self-start rounded-bl-md bg-surface-2" : "self-end rounded-br-md bg-accent text-accent-fg",
            )}
          >
            {m.fromOwner && <p className="text-[11px] font-semibold text-accent">Tu encargado</p>}
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
            <p className={cn("mt-0.5 text-right text-[11px]", m.fromOwner ? "text-muted" : "opacity-80")}>{m.at}</p>
          </div>
        ))}
        <textarea
          aria-label="Escribe un mensaje"
          value={reply}
          maxLength={1000}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="min-h-[70px] w-full rounded-control bg-surface-2 px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          disabled={pending || !reply.trim()}
          onClick={() =>
            start(async () => {
              const r = await replyVacationMessage({ text: reply }).catch(() => ({ ok: false as const, error: "Sin conexión." }));
              if (r.ok) {
                setReply("");
                notify("Mensaje enviado");
                router.refresh();
              } else notify(r.error, "error");
            })
          }
          className="press min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
        >
          Enviar mensaje
        </button>
      </section>

      {/* Barra de abajo: enviar (con firma) o el último envío firmado. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {dirty ? (
            <>
              <button
                type="button"
                disabled={!editable}
                onClick={() => setSending(true)}
                className="press min-h-12 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-fg disabled:opacity-40"
              >
                Enviar a mi encargado
              </button>
              <button type="button" onClick={() => setPeriods(live)} className="min-h-10 text-[15px] font-medium text-accent">
                Deshacer cambios
              </button>
            </>
          ) : (
            pendingSignature ? (
              <button
                type="button"
                onClick={() => setSigning(true)}
                className="press min-h-12 w-full rounded-control bg-[#16a34a] text-[17px] font-semibold text-white"
              >
                Firmar mis vacaciones
              </button>
            ) : (
              <p className="py-2 text-center text-[14px] text-muted">
                {waiting || cancels.length > 0
                  ? "Enviado. Falta que tu encargado lo apruebe."
                  : signedAt
                    ? `✓ Aprobadas y firmadas el ${signedAt}`
                    : "Marca tus vacaciones en el calendario."}
              </p>
            )
          )}
        </div>
      </div>

      <BottomSheet
        open={!!removing?.open}
        onClose={() => setRemoving((r) => (r ? { ...r, open: false } : r))}
        title={removingPeriod ? rangeLabel(removingPeriod) : "Periodo"}
      >
        {removingPeriod && (
          <div className="flex flex-col gap-3">
            <p className="text-[15px]">
              {vacationSpan(removingPeriod).days.length} días · descuenta {vacationSpan(removingPeriod).counted} laborables.
            </p>
            <button
              type="button"
              onClick={() => {
                setPeriods((ps) => ps.filter((_, i) => i !== removing!.index));
                setRemoving((r) => (r ? { ...r, open: false } : r));
              }}
              className="min-h-12 w-full rounded-control bg-danger/10 text-[16px] font-semibold text-danger"
            >
              Quitar este periodo
            </button>
            <p className="text-[13px] text-muted">
              {removingPeriod.status === "APPLIED"
                ? "Ya está en el planning: al enviarlo, tu encargado tiene que aceptar quitarlo."
                : "El cambio no se guarda hasta que lo envíes."}
            </p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sending} onClose={() => setSending(false)} title="Enviar a tu encargado">
        <div className="flex flex-col gap-3">
          <section className="rounded-card bg-surface-2 px-4 py-3">
            <h2 className="mb-1 text-[15px] font-semibold">Lo que pides para {year}</h2>
            <ul className="flex flex-col gap-0.5 text-[15px]">
              {sortRanges(periods).map((p) => (
                <li key={`${p.start}${p.end}`}>
                  <b>{rangeLabel(p)}</b> · {vacationSpan(p).days.length} días (descuenta {vacationSpan(p).counted})
                </li>
              ))}
              {periods.length === 0 && <li className="text-muted">Nada (quitas todo lo que habías pedido).</li>}
            </ul>
            <p className="mt-1.5 text-[14px]">
              <b>{used}</b> de {workDays} días laborables
            </p>
          </section>
          <p className="text-[14px] text-muted">
            Tu encargado lo revisa. Cuando te lo apruebe, te pedirá que lo firmes.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={send}
            className="press min-h-12 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-fg disabled:opacity-40"
          >
            {pending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={signing} onClose={() => setSigning(false)} title="Firmar vacaciones">
        <div className="flex flex-col gap-3">
          <section className="rounded-card bg-surface-2 px-4 py-3">
            <h2 className="mb-1 text-[15px] font-semibold">Tus vacaciones aprobadas de {year}</h2>
            <ul className="flex flex-col gap-0.5 text-[15px]">
              {sortRanges(live).map((p) => (
                <li key={`${p.start}${p.end}`}>
                  <b>{rangeLabel(p)}</b> · {vacationSpan(p).days.length} días (descuenta {vacationSpan(p).counted})
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[14px]">
              <b>{used}</b> de {workDays} días laborables
            </p>
          </section>
          <p className="text-[14px] text-muted">
            Firma con el dedo para confirmar que estas son tus vacaciones. Queda guardado en tu ficha; si más adelante se
            cambian, se vuelven a firmar.
          </p>
          <SignaturePad ref={pad} onChange={setHasInk} />
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" onClick={() => pad.current?.clear()} className="min-h-12 rounded-control bg-surface-2 text-[16px] font-medium">
              Borrar
            </button>
            <button
              type="button"
              disabled={!hasInk || pending}
              onClick={sign}
              className="press min-h-12 rounded-control bg-accent text-[17px] font-semibold text-accent-fg disabled:opacity-40"
            >
              {pending ? "Firmando…" : "Firmar"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-[4px]", className)} />
      {label}
    </span>
  );
}

function Month({
  year,
  month,
  label,
  dayInfo,
  blocked,
  first,
  editable,
  onTap,
}: {
  year: number;
  month: number;
  label: string;
  dayInfo: Map<DateStr, { kind: "work" | "fiesta"; index: number }>;
  blocked: ReadonlySet<DateStr>;
  first: DateStr | null;
  editable: boolean;
  onTap: (d: DateStr) => void;
}) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01` as DateStr;
  const days: DateStr[] = [];
  for (let d = start; d.slice(5, 7) === start.slice(5, 7); d = addDays(d, 1)) days.push(d);
  const lead = weekdayIndex(start);
  return (
    <section aria-label={`${label} ${year}`} className="rounded-card bg-surface px-3 pb-3 pt-2.5">
      <h2 className="mb-1.5 px-1 text-[16px] font-semibold">
        {label} {year}
      </h2>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((d) => {
          const info = dayInfo.get(d);
          const isBlocked = blocked.has(weekStart(d));
          const prev = dayInfo.get(addDays(d, -1));
          const next = dayInfo.get(addDays(d, 1));
          const startCap = info && (!prev || prev.index !== info.index || weekdayIndex(d) === 0);
          const endCap = info && (!next || next.index !== info.index || weekdayIndex(d) === 6);
          return (
            <button
              key={d}
              type="button"
              disabled={!editable && !info}
              onClick={() => onTap(d)}
              aria-label={`${Number(d.slice(8))} de ${label}${info ? (info.kind === "work" ? ", vacaciones" : ", tu fiesta") : isBlocked ? ", no se puede" : ""}`}
              className={cn(
                "relative flex h-10 items-center justify-center text-[15px] tabular-nums",
                info?.kind === "work" && "bg-[#3b82f6] font-semibold text-white",
                info?.kind === "fiesta" && "bg-[#bfdbfe] font-semibold text-[#1e3a8a]",
                startCap && "rounded-l-full",
                endCap && "rounded-r-full",
                !info && isBlocked && "vac-blocked text-muted",
                first === d && "rounded-full bg-accent font-semibold text-accent-fg ring-2 ring-accent ring-offset-2 ring-offset-surface",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </section>
  );
}

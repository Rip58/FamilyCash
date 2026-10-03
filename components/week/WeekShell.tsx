"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { copyPreviousWeek, repeatWeekToMonthEnd, resetWeek } from "@/app/actions/week";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/components/ui/cn";
import { type DateStr, addDays, formatDayMonth, formatWeekRange, isoWeekNumber, weekStart as weekStartOf } from "@/lib/dates";
import { remainingMonthWeeks, weekHref } from "@/lib/week";
import dynamic from "next/dynamic";
import { PeopleGrid } from "./PeopleGrid";
import type { PeopleGridData, WeekViewMode } from "./types";

// Solo se descarga al abrir "Ordenar" (lleva la librería de arrastrar).
const RotaOrderSheet = dynamic(() => import("./RotaOrderSheet"), { ssr: false });

const STORAGE_KEY = "semana:vista";
const FLAT_KEY = "semana:sinDepartamentos";

type Kind = "copy" | "repeat" | "reset";
const SWIPE_PX = 60;

function isView(v: string | null): v is WeekViewMode {
  return v === "dias" || v === "personas";
}

export function WeekShell({
  weekStart,
  today,
  initialView,
  people,
  daysView,
}: {
  weekStart: DateStr;
  today: DateStr;
  /** Vista pedida en la URL (?v=); null si no hay. */
  initialView: WeekViewMode | null;
  people: PeopleGridData;
  daysView: ReactNode;
}) {
  const router = useRouter();
  const [view, setView] = useState<WeekViewMode>(initialView ?? "dias");
  const [menu, setMenu] = useState<{ open: boolean; confirm: Kind | null; message: string | null }>({
    open: false,
    confirm: null,
    message: null,
  });
  const [pending, startTransition] = useTransition();
  // Vista Personas sin departamentos (orden del Excel): se recuerda en este móvil.
  const [flat, setFlat] = useState(false);
  const [sorting, setSorting] = useState<{ open: boolean; n: number }>({ open: false, n: 0 });
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(FLAT_KEY) === "1") setFlat(true);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  const toggleFlat = () => {
    const next = !flat;
    setFlat(next);
    try {
      localStorage.setItem(FLAT_KEY, next ? "1" : "0");
    } catch {
      /* ignorar */
    }
    chooseView("personas");
    setMenu({ open: false, confirm: null, message: null });
  };
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Sin ?v= en la URL: recordar la última vista elegida.
  useEffect(() => {
    if (initialView) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isView(saved) && saved !== "dias") setView(saved);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [initialView]);

  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const isCurrentWeek = weekStartOf(today) === weekStart;
  const prevHref = weekHref(prev, view);
  const nextHref = weekHref(next, view);

  const chooseView = (v: WeekViewMode) => {
    setView(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignorar */
    }
    const url = new URL(window.location.href);
    if (v === "personas") url.searchParams.set("v", v);
    else url.searchParams.delete("v");
    window.history.replaceState(null, "", url.pathname + url.search);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    router.push(dx < 0 ? nextHref : prevHref);
  };

  const repeatTargets = remainingMonthWeeks(weekStart);
  const repeatRange =
    repeatTargets.length > 0
      ? `${formatDayMonth(repeatTargets[0]!)} – ${formatDayMonth(addDays(repeatTargets[repeatTargets.length - 1]!, 6))}`
      : "";

  const run = (kind: Kind) => {
    startTransition(async () => {
      const res =
        kind === "copy"
          ? await copyPreviousWeek(weekStart)
          : kind === "repeat"
            ? await repeatWeekToMonthEnd(weekStart)
            : await resetWeek(weekStart);
      if (res.ok) {
        setMenu({ open: false, confirm: null, message: null });
      } else {
        setMenu((m) => ({ ...m, message: res.error }));
      }
    });
  };

  const iconBtn =
    "flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-accent active:bg-surface-2 [touch-action:manipulation]";
  const navBtn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[26px] leading-none text-accent active:bg-surface-2";

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[60dvh] pt-2">
      <header className="flex items-center justify-between gap-1">
        <Link href={prevHref} aria-label="Semana anterior" className={navBtn}>
          ‹
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold tracking-tight" aria-live="polite">
          Semana {isoWeekNumber(weekStart)} <span className="text-muted">·</span> {formatWeekRange(weekStart)}
        </h1>
        <Link href={nextHref} aria-label="Semana siguiente" className={navBtn}>
          ›
        </Link>
      </header>

      <div className="mt-1 mb-2 flex items-center gap-1">
        <Segmented<WeekViewMode>
          aria-label="Vista"
          compact
          className="min-w-0 flex-1"
          value={view}
          onChange={chooseView}
          options={[
            { value: "dias", label: "Días" },
            { value: "personas", label: "Personas" },
          ]}
        />
        {!isCurrentWeek && (
          <Link href={weekHref(null, view)} className="flex h-11 shrink-0 items-center px-0.5">
            <span className="flex h-8 items-center rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-fg">Hoy</span>
          </Link>
        )}
        {view === "personas" && (
          <button
            type="button"
            onClick={toggleFlat}
            aria-pressed={flat}
            aria-label={flat ? "Agrupar por departamentos" : "Ver sin departamentos (orden del Excel)"}
            className={iconBtn}
          >
            <Icon name={flat ? "group" : "list"} className="h-5 w-5" />
          </button>
        )}
        {view === "personas" && flat && (
          <button
            type="button"
            aria-label="Ordenar la lista"
            onClick={() => setSorting((s) => ({ open: true, n: s.n + 1 }))}
            className={iconBtn}
          >
            <Icon name="sort" className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          aria-label="Acciones de la semana"
          onClick={() => setMenu({ open: true, confirm: null, message: null })}
          className={cn(iconBtn, "text-[20px] leading-none text-fg")}
        >
          ⋯
        </button>
      </div>

      <div className={cn(view === "dias" ? "block" : "hidden")}>{daysView}</div>
      {view === "personas" && <PeopleGrid data={people} flat={flat} />}
      {sorting.n > 0 && (
        <RotaOrderSheet
          key={sorting.n}
          open={sorting.open}
          onClose={() => setSorting((s) => ({ ...s, open: false }))}
          people={people.flatGroups.flatMap((g) => g.rows).map((r) => ({ id: r.employeeId, name: r.name, departmentName: r.departmentName }))}
        />
      )}

      <BottomSheet
        open={menu.open}
        onClose={() => setMenu((m) => ({ ...m, open: false }))}
        title={
          menu.confirm === "copy"
            ? "Copiar semana anterior"
            : menu.confirm === "repeat"
              ? "Repetir hasta fin de mes"
              : menu.confirm === "reset"
                ? "Restablecer semana"
                : "Semana"
        }
      >
        <div className="flex flex-col gap-2 pt-1">
          {menu.confirm === null && (
            <>
              <button
                type="button"
                disabled={repeatTargets.length === 0}
                onClick={() => setMenu((m) => ({ ...m, confirm: "repeat" }))}
                className="flex min-h-12 flex-col justify-center rounded-control bg-accent/10 px-4 text-left text-[16px] font-semibold text-accent disabled:opacity-40"
              >
                Repetir esta semana hasta fin de mes
                <span className="text-[13px] font-normal text-muted">
                  {repeatTargets.length > 0
                    ? `${repeatTargets.length} ${repeatTargets.length === 1 ? "semana" : "semanas"}: ${repeatRange}`
                    : "Es la última semana del mes"}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleFlat}
                aria-pressed={flat}
                className="flex min-h-12 flex-col justify-center rounded-control bg-surface-2 px-4 text-left text-[16px]"
              >
                {flat ? "🗂️ Ver por departamentos" : "📋 Ver sin departamentos (orden del Excel)"}
                <span className="text-[13px] text-muted">
                  {flat
                    ? "Vuelve a agrupar a la plantilla por departamento"
                    : "Todos en una lista, como en el Excel, para poner las fiestas"}
                </span>
              </button>
              <Link
                href={`/semana/importar?semana=${weekStart}`}
                className="flex min-h-12 flex-col justify-center rounded-control bg-surface-2 px-4 text-left text-[16px]"
              >
                ✨ Cargar desde imagen (IA)
                <span className="text-[13px] text-muted">Foto o captura del Excel del planning</span>
              </Link>
              <button
                type="button"
                onClick={() => setMenu((m) => ({ ...m, confirm: "copy" }))}
                className="min-h-11 rounded-control bg-surface-2 px-4 text-left text-[16px]"
              >
                Copiar semana anterior
              </button>
              <button
                type="button"
                onClick={() => setMenu((m) => ({ ...m, confirm: "reset" }))}
                className="min-h-11 rounded-control bg-surface-2 px-4 text-left text-[16px]"
              >
                Restablecer a días fijos
              </button>
            </>
          )}
          {menu.confirm !== null && (
            <>
              <p className="text-[15px]">
                {menu.confirm === "copy"
                  ? "Se copiarán estados, departamentos y motivos de la semana anterior y se sobrescribirán los de esta semana. Las notas, horarios y tareas se conservan."
                  : menu.confirm === "repeat"
                    ? `Se copiará quién trabaja, quién libra y en qué departamento a ${repeatTargets.length === 1 ? "la semana" : `las ${repeatTargets.length} semanas`} del ${repeatRange}. Las vacaciones, bajas y otras ausencias de esta semana no se repiten, y las que ya estén puestas en esas semanas se respetan.`
                    : "Se borrarán los cambios de esta semana (estados y motivos) y cada persona volverá a sus días fijos. Se conservan los días con nota, horario o tareas."}
              </p>
              {menu.message && (
                <p role="alert" className="text-[14px] text-danger">
                  {menu.message}
                </p>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(menu.confirm!)}
                className={cn(
                  "min-h-11 rounded-control text-[16px] font-semibold text-white disabled:opacity-50",
                  menu.confirm === "reset" ? "bg-danger" : "bg-accent",
                )}
              >
                {pending
                  ? "Aplicando…"
                  : menu.confirm === "copy"
                    ? "Sobrescribir con la anterior"
                    : menu.confirm === "repeat"
                      ? "Repetir hasta fin de mes"
                      : "Restablecer"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setMenu((m) => ({ ...m, confirm: null, message: null }))}
                className="min-h-11 rounded-control bg-surface-2 text-[16px]"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

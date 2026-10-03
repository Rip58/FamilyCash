"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { applyImportedWeek } from "@/app/actions/week";
import { notify } from "@/components/ui/toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { tint } from "@/components/ui/icons";
import type { AiProvider, ImportResult, ImportRow } from "@/lib/ai-import-format";
import { type DateStr, WEEKDAY_LETTERS, addDays, formatDayLong, formatDayMonth, formatWeekRange, isoWeekNumber, weekDays } from "@/lib/dates";
import { DOCUMENT_IMAGE, compressImage } from "@/lib/image-compress";
import { isDayOffStatus } from "@/lib/schedule";
import { statusAbbr, weekSummary } from "@/lib/week";
import type { GridStatus } from "./types";

interface ImportEmployee {
  id: string;
  name: string;
  /** Nombre corto como en Semana. */
  short: string;
  /** Planning actual de la semana (statusTypeId por día, lunes → domingo). */
  current: string[];
}

interface Props {
  weekStart: DateStr;
  daysOffPerWeek: number;
  provider: { id: AiProvider; label: string; model: string; configured: boolean };
  employees: ImportEmployee[];
  statuses: GridStatus[];
}

type Editing =
  | { kind: "person"; row: number; open: boolean }
  | { kind: "cell"; row: number; day: number; open: boolean };

type Phase = { kind: "pick" } | { kind: "reading" } | { kind: "review"; result: ImportResult } | { kind: "error"; message: string };

const GRID_COLS = "grid-cols-[minmax(0,1fr)_repeat(7,34px)_60px]";

/** Semana → Cargar desde imagen: la IA lee el cuadrante, se revisa aquí y se guarda en el planning. */
export function WeekImport({ weekStart, daysOffPerWeek, provider, employees, statuses }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [saving, startSave] = useTransition();
  const [saveOrder, setSaveOrder] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const days = weekDays(weekStart);
  const back = `/semana/${weekStart}?v=personas`;

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPhase({ kind: "pick" });
  }

  async function read() {
    if (!file) return;
    setPhase({ kind: "reading" });
    try {
      // Más resolución que las fotos normales para que se lea bien el texto de la tabla.
      const img = await compressImage(file, DOCUMENT_IMAGE);
      const form = new FormData();
      form.append("file", img.blob, "cuadrante");
      form.append("weekStart", weekStart);
      const res = await fetch("/api/ai/import-week", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; result?: ImportResult } | null;
      if (!body?.ok || !body.result) throw new Error(body?.error ?? "No se pudo leer la imagen.");
      setRows(body.result.rows);
      setPhase({ kind: "review", result: body.result });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "No se pudo leer la imagen." });
    }
  }

  const patchRow = (i: number, p: Partial<ImportRow>) => setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const taken = new Map(rows.flatMap((r, i) => (r.employeeId ? [[r.employeeId, i] as const] : [])));
  const toSave = rows.filter((r) => r.employeeId);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const changes = toSave.reduce(
    (n, r) => n + r.cells.filter((c, k) => c && c !== byId.get(r.employeeId!)?.current[k]).length,
    0,
  );
  const editRow = editing ? rows[editing.row] : undefined;
  const unknownCells = toSave.reduce((n, r) => n + r.cells.filter((c) => !c).length, 0);
  const missing = employees.filter((e) => !taken.has(e.id));

  function save() {
    startSave(async () => {
      const r = await applyImportedWeek({
        weekStart,
        rows: toSave.map((row) => ({ employeeId: row.employeeId!, cells: row.cells })),
        saveOrder,
      });
      if (!r.ok) {
        notify(r.error, "error");
        return;
      }
      notify(`Semana cargada (${r.changed ?? 0} cambios)`);
      router.push(back);
    });
  }

  return (
    <div className="pb-28 pt-2">
      <header className="flex items-center gap-1">
        <Link href={back} aria-label="Volver a la Semana" className="flex min-h-11 min-w-11 items-center justify-center text-[26px] text-accent">
          ‹
        </Link>
        <h1 className="flex-1 text-[20px] font-bold tracking-tight">Cargar semana desde imagen</h1>
      </header>

      <nav aria-label="Semana" className="mt-1 flex items-center justify-between rounded-card bg-surface px-1">
        <Link href={`/semana/importar?semana=${addDays(weekStart, -7)}`} aria-label="Semana anterior" className="flex min-h-11 min-w-11 items-center justify-center text-[24px] text-accent">
          ‹
        </Link>
        <span className="text-[16px] font-semibold">
          Semana {isoWeekNumber(weekStart)} · {formatWeekRange(weekStart)}
        </span>
        <Link href={`/semana/importar?semana=${addDays(weekStart, 7)}`} aria-label="Semana siguiente" className="flex min-h-11 min-w-11 items-center justify-center text-[24px] text-accent">
          ›
        </Link>
      </nav>

      <p className="mt-2 px-1 text-[13px] text-muted">
        La leerá {provider.label} ({provider.model}).{" "}
        <Link href="/ajustes/ia" className="text-accent">
          Cambiar
        </Link>
      </p>
      {!provider.configured && (
        <p role="alert" className="mt-2 rounded-card bg-warning/15 px-4 py-3 text-[14px]">
          Falta la clave de {provider.label} en Vercel. Mira cómo ponerla en{" "}
          <Link href="/ajustes/ia" className="font-semibold text-accent">
            Ajustes → Importar con IA
          </Link>
          .
        </p>
      )}

      {phase.kind !== "review" && (
        <section className="mt-3 flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Imagen del cuadrante"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Imagen elegida" className="max-h-[50vh] w-full rounded-card bg-surface object-contain" />
          ) : (
            <p className="rounded-card bg-surface px-4 py-6 text-center text-[15px] text-muted">
              Haz una foto o captura del Excel con la semana (nombres a la izquierda, días arriba) y elígela aquí.
            </p>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={phase.kind === "reading"}
            className="flex min-h-12 items-center justify-center gap-2 rounded-control bg-surface text-[16px] font-medium text-accent disabled:opacity-50"
          >
            <span aria-hidden>📷</span> {preview ? "Elegir otra imagen" : "Hacer foto / Elegir imagen"}
          </button>
          {phase.kind === "error" && (
            <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
              {phase.message}
            </p>
          )}
          <button
            type="button"
            onClick={read}
            disabled={!file || phase.kind === "reading"}
            className="min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
          >
            {phase.kind === "reading" ? "Leyendo con IA… (hasta 1 min)" : "Leer con IA"}
          </button>
        </section>
      )}

      {phase.kind === "review" && (
        <section className="mt-3 flex flex-col gap-3" aria-label="Vista previa">
          {phase.result.detectedWeekStart && phase.result.detectedWeekStart !== weekStart && (
            <p role="alert" className="rounded-card bg-warning/15 px-4 py-3 text-[14px]">
              ⚠️ La imagen parece de la semana del {formatDayMonth(phase.result.detectedWeekStart)}, y vas a cargarla en la del{" "}
              {formatDayMonth(weekStart)}. Revisa la semana arriba antes de guardar.
            </p>
          )}
          {phase.result.notes && (
            <p className="rounded-card bg-surface px-4 py-3 text-[14px]">
              <b>Nota de la IA:</b> {phase.result.notes}
            </p>
          )}
          <p className="px-1 text-[13px] text-muted">
            Revisa y corrige. Las filas sin persona no se cargan; las casillas con «?» se dejan como estaban.
          </p>

          <ImportGrid
            rows={rows}
            days={days}
            employees={employees}
            statuses={statuses}
            daysOffPerWeek={daysOffPerWeek}
            onPerson={(i) => setEditing({ kind: "person", row: i, open: true })}
            onCell={(i, k) => setEditing({ kind: "cell", row: i, day: k, open: true })}
          />
          <p className="px-1 text-[12px] text-muted">
            Igual que en Semana: toca un nombre para cambiar la persona y una casilla para cambiar el estado. Con borde azul =
            cambia respecto al planning actual · «?» = no se entendió (se deja como está).
          </p>

          {missing.length > 0 && (
            <p className="px-1 text-[13px] text-muted">
              No aparecen en la imagen (se quedan como estaban): {missing.map((e) => e.name.split(" ")[0]).join(", ")}.
            </p>
          )}

          <label className="flex min-h-12 items-center gap-3 rounded-card bg-surface px-4 text-[15px]">
            <input
              type="checkbox"
              checked={saveOrder}
              onChange={(e) => setSaveOrder(e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            <span>
              Guardar este orden de filas como el del Excel
              <span className="block text-[13px] text-muted">Para la vista de Semana sin departamentos</span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => setPhase({ kind: "pick" })}
            className="min-h-11 rounded-control bg-surface text-[15px] font-medium text-accent"
          >
            Volver a leer otra imagen
          </button>

          <BottomSheet
            open={!!editing?.open}
            onClose={() => setEditing((e) => (e ? { ...e, open: false } : e))}
            title={
              editing && editRow
                ? editing.kind === "person"
                  ? `En la imagen: «${editRow.name}»`
                  : `${editRow.employeeId ? byId.get(editRow.employeeId)?.name : editRow.name} · ${formatDayLong(days[editing.day]!)}`
                : ""
            }
          >
            {editing?.kind === "person" && editRow && (
              <ul className="flex flex-col gap-1 pb-2">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      patchRow(editing.row, { employeeId: null });
                      setEditing({ ...editing, open: false });
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center rounded-control bg-surface-2 px-4 text-left text-[15px] text-muted",
                      !editRow.employeeId && "ring-2 ring-accent",
                    )}
                  >
                    — No cargar esta fila —
                  </button>
                </li>
                {employees.map((e) => {
                  const used = taken.has(e.id) && taken.get(e.id) !== editing.row;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        disabled={used}
                        onClick={() => {
                          patchRow(editing.row, { employeeId: e.id });
                          setEditing({ ...editing, open: false });
                        }}
                        className={cn(
                          "flex min-h-11 w-full items-center justify-between rounded-control bg-surface-2 px-4 text-left text-[15px] disabled:opacity-40",
                          editRow.employeeId === e.id && "ring-2 ring-accent",
                        )}
                      >
                        {e.name}
                        {used && <span className="text-[12px] text-muted">ya en otra fila</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {editing?.kind === "cell" && editRow && (
              <div className="flex flex-col gap-2 pb-2">
                {editRow.employeeId && (
                  <p className="px-1 text-[13px] text-muted">
                    Ahora en el planning: {statuses.find((s) => s.id === byId.get(editRow.employeeId!)?.current[editing.day])?.label ?? "—"}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {statuses.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        patchRow(editing.row, { cells: editRow.cells.map((c, j) => (j === editing.day ? s.id : c)) });
                        setEditing({ ...editing, open: false });
                      }}
                      className={cn(
                        "flex min-h-12 items-center gap-2 rounded-control border-2 px-3 text-left text-[15px] font-medium",
                        editRow.cells[editing.day] === s.id ? "border-accent" : "border-transparent",
                      )}
                      style={{ backgroundColor: tint(s.color, 22) }}
                    >
                      <span className="w-6 text-center font-bold">{statusAbbr(s)}</span>
                      {s.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      patchRow(editing.row, { cells: editRow.cells.map((c, j) => (j === editing.day ? null : c)) });
                      setEditing({ ...editing, open: false });
                    }}
                    className={cn(
                      "col-span-2 flex min-h-12 items-center justify-center rounded-control border-2 border-dashed px-3 text-[15px] text-muted",
                      editRow.cells[editing.day] === null ? "border-accent" : "border-warning",
                    )}
                  >
                    ? · Dejar como está
                  </button>
                </div>
              </div>
            )}
          </BottomSheet>

          <div
            className="fixed inset-x-0 z-30 mx-auto flex max-w-xl flex-col gap-1 px-4"
            style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)" }}
          >
            <button
              type="button"
              onClick={save}
              disabled={saving || toSave.length === 0}
              className="min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg shadow-lg disabled:opacity-40"
            >
              {saving
                ? "Guardando…"
                : `Guardar en la semana · ${changes} ${changes === 1 ? "cambio" : "cambios"}`}
            </button>
            {unknownCells > 0 && (
              <span className="rounded-full bg-bg/90 py-0.5 text-center text-[12px] text-muted">
                {unknownCells} {unknownCells === 1 ? "casilla" : "casillas"} con «?» no se tocarán
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Vista previa con el mismo aspecto que Semana → Personas (sin departamentos, en el orden de la imagen). */
function ImportGrid({
  rows,
  days,
  employees,
  statuses,
  daysOffPerWeek,
  onPerson,
  onCell,
}: {
  rows: ImportRow[];
  days: DateStr[];
  employees: ImportEmployee[];
  statuses: GridStatus[];
  daysOffPerWeek: number;
  onPerson: (row: number) => void;
  onCell: (row: number, day: number) => void;
}) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  return (
    <div className="-mx-4">
      <div className={cn("sticky top-[env(safe-area-inset-top)] z-10 grid items-end border-b border-line bg-bg pb-1", GRID_COLS)}>
        <span className="px-4 pb-1 text-[12px] font-medium text-muted">Persona</span>
        {days.map((d, i) => (
          <span key={d} className="flex flex-col items-center leading-tight">
            <span className="text-[12px] font-semibold text-muted">{WEEKDAY_LETTERS[i]}</span>
            <span className="text-[12px] text-muted">{Number(d.slice(8))}</span>
          </span>
        ))}
        <span className="pb-1 text-center text-[11px] font-medium text-muted">Total</span>
      </div>
      <section aria-label="Semana leída" className="mx-1.5 mt-2 overflow-hidden rounded-card bg-surface">
        {rows.map((row, i) => {
          const emp = row.employeeId ? byId.get(row.employeeId) : undefined;
          // Lo que quedará: lo leído, o el planning actual en las casillas «?».
          const final = row.cells.map((c, k) => (c ?? emp?.current[k] ?? null));
          const known = final.flatMap((id) => (id && statusById.get(id) ? [statusById.get(id)!] : []));
          const daysOff = known.filter((s) => isDayOffStatus(s)).length;
          const warn = !!emp && known.length === 7 && daysOff !== daysOffPerWeek;
          const summary = emp ? weekSummary(known.map((s) => ({ status: s, extraMinutes: null })), statuses) : [];
          return (
            <div key={i} className={cn("grid items-center border-b border-line last:border-b-0", GRID_COLS, !emp && "opacity-60")}>
              <button
                type="button"
                onClick={() => onPerson(i)}
                aria-label={`Fila «${row.name}»: ${emp ? emp.name : "sin persona"}. Toca para cambiar`}
                className="flex h-11 min-w-0 flex-col justify-center pl-4 pr-1 text-left [touch-action:manipulation]"
              >
                <span className={cn("truncate text-[15px] leading-tight", !emp && "font-medium text-warning")}>
                  {emp ? emp.short : "¿Quién?"}
                </span>
                {(!emp || ![emp.name, emp.short].some((n) => normalizeName(n) === normalizeName(row.name))) && (
                  <span className="truncate text-[11px] leading-tight text-muted">«{row.name}»</span>
                )}
              </button>
              {days.map((d, k) => {
                const id = row.cells[k];
                const st = id ? statusById.get(id) : undefined;
                const changed = !!emp && !!id && id !== emp.current[k];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onCell(i, k)}
                    aria-label={`${emp?.name ?? row.name}, ${formatDayLong(d)}: ${st ? st.label : "no se entiende, se deja como está"}${changed ? " (cambia)" : ""}`}
                    className="relative flex h-11 w-[34px] select-none items-center justify-center [touch-action:manipulation]"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-[30px] items-center justify-center rounded-[8px] border text-[13px] font-semibold",
                        st ? (st.isWorking ? "text-muted" : "text-fg") : "border-dashed border-warning text-warning",
                        changed && "ring-2 ring-accent",
                      )}
                      style={
                        st
                          ? { borderColor: `${st.color}${st.isWorking ? "55" : "cc"}`, backgroundColor: `${st.color}${st.isWorking ? "1a" : "44"}` }
                          : undefined
                      }
                    >
                      {st ? statusAbbr(st) : "?"}
                    </span>
                  </button>
                );
              })}
              <span
                className="flex flex-wrap content-center justify-center gap-x-1 px-0.5 text-[11px] font-semibold leading-[13px] tabular-nums"
                data-warning={warn ? "true" : undefined}
              >
                {summary.map((t) => (
                  <span key={t.key} className={cn("text-muted", warn && t.dayOff && "rounded bg-warning/25 px-0.5 text-warning")}>
                    {t.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

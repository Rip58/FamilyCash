"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { applyImportedWeek } from "@/app/actions/week";
import { notify } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import type { AiProvider, ImportResult, ImportRow } from "@/lib/ai-import-format";
import { type DateStr, WEEKDAY_SHORT, addDays, formatDayMonth, formatWeekRange, isoWeekNumber, weekDays } from "@/lib/dates";
import { DOCUMENT_IMAGE, compressImage } from "@/lib/image-compress";
import { statusAbbr } from "@/lib/week";

interface Props {
  weekStart: DateStr;
  provider: { id: AiProvider; label: string; model: string; configured: boolean };
  employees: { id: string; name: string }[];
  statuses: { id: string; code: string; label: string; color: string }[];
}

type Phase = { kind: "pick" } | { kind: "reading" } | { kind: "review"; result: ImportResult } | { kind: "error"; message: string };

const selectCls = "min-h-11 w-full rounded-control bg-surface-2 px-2 text-[15px] outline-none focus:ring-2 focus:ring-accent";

/** Semana → Cargar desde imagen: la IA lee el cuadrante, se revisa aquí y se guarda en el planning. */
export function WeekImport({ weekStart, provider, employees, statuses }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [saving, startSave] = useTransition();
  const [saveOrder, setSaveOrder] = useState(true);
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

          <ul className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <li key={i} className={cn("rounded-card bg-surface p-3", !row.employeeId && "opacity-70")}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted">En la imagen: «{row.name}»</span>
                </div>
                <select
                  aria-label={`Persona para «${row.name}»`}
                  value={row.employeeId ?? ""}
                  onChange={(e) => patchRow(i, { employeeId: e.target.value || null })}
                  className={cn(selectCls, "mt-1 font-semibold", !row.employeeId && "ring-2 ring-warning")}
                >
                  <option value="">— No cargar esta fila —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id} disabled={taken.has(e.id) && taken.get(e.id) !== i}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {days.map((d, k) => {
                    const st = statuses.find((s) => s.id === row.cells[k]);
                    return (
                      <label key={d} className="flex flex-col items-center gap-0.5">
                        <span className="text-[11px] font-medium text-muted">{WEEKDAY_SHORT[k]}</span>
                        {/* Casilla con solo la letra; el desplegable nativo (invisible encima) muestra el nombre completo. */}
                        <span
                          className="relative flex h-11 w-full items-center justify-center rounded-[8px] border text-[15px] font-bold"
                          style={
                            st
                              ? { borderColor: `${st.color}cc`, backgroundColor: `${st.color}33` }
                              : { borderColor: "var(--warning)", backgroundColor: "transparent" }
                          }
                        >
                          {st ? statusAbbr(st) : "?"}
                          <select
                            aria-label={`${row.name}, ${WEEKDAY_SHORT[k]} ${d.slice(8)}`}
                            value={row.cells[k] ?? ""}
                            onChange={(e) =>
                              patchRow(i, { cells: row.cells.map((c, j) => (j === k ? e.target.value || null : c)) })
                            }
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          >
                            <option value="">? · Dejar como está</option>
                            {statuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {statusAbbr(s)} · {s.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

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
                : `Cargar ${toSave.length} ${toSave.length === 1 ? "persona" : "personas"} en la semana del ${formatDayMonth(weekStart)}`}
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

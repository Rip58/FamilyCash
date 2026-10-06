"use client";

import { useMemo, useState } from "react";
import { tint } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { type HistoryItem, type HistoryKind, KIND_META, groupHistory, historyCounts, historyToText } from "@/lib/employee-history";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Historial por noche (desplegable) con filtro por tipo, búsqueda y exportar. Se usa en Informe → lupa (empleado,
 * notas generales, departamento, todas) y en la ficha del empleado (Ajustes → Empleados → Historial).
 */
export function EmployeeHistoryView({
  name,
  items,
  currentYear,
  heading,
  onEditFileNote,
}: {
  name: string;
  items: HistoryItem[];
  currentYear: number;
  /** Primera línea del texto exportado (por defecto «HISTORIAL DE …»). */
  heading?: string;
  /** Ficha del empleado: las notas de ficha se pueden editar. */
  onEditFileNote?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<HistoryKind | null>(null);
  const counts = useMemo(() => historyCounts(items), [items]);
  const days = useMemo(() => groupHistory(items, currentYear, q, kind ? [kind] : []), [items, currentYear, q, kind]);
  const text = useMemo(() => historyToText(name, days, heading), [name, days, heading]);
  const total = days.reduce((n, d) => n + d.items.length, 0);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copy();
  }
  async function copy() {
    const ok = await copyText(text);
    notify(ok ? "Historial copiado" : "No se pudo copiar", ok ? "ok" : "error");
  }

  if (items.length === 0) {
    return <p className="rounded-card bg-surface px-4 py-8 text-center text-[15px] text-muted">No hay nada apuntado todavía.</p>;
  }

  const chip = "press min-h-9 rounded-full px-3 text-[13px] font-semibold";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
        <button
          type="button"
          aria-pressed={kind === null}
          onClick={() => setKind(null)}
          className={`${chip} ${kind === null ? "bg-fg text-bg" : "bg-surface text-muted"}`}
        >
          Todo · {items.length}
        </button>
        {counts.map((c) => {
          const on = kind === c.kind;
          const color = KIND_META[c.kind].color;
          return (
            <button
              key={c.kind}
              type="button"
              aria-pressed={on}
              onClick={() => setKind(on ? null : c.kind)}
              className={chip}
              style={on ? { backgroundColor: color, color: "#fff" } : { backgroundColor: tint(color, 16), color }}
            >
              {KIND_META[c.kind].label} · {c.count}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar en el historial"
          className="min-h-11 min-w-0 flex-1 rounded-control bg-surface px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="button" onClick={share} className="press min-h-11 shrink-0 rounded-control bg-accent px-3 text-[15px] font-semibold text-accent-fg">
          Compartir
        </button>
        <button type="button" onClick={copy} className="press min-h-11 shrink-0 rounded-control bg-surface px-3 text-[15px] font-medium">
          Copiar
        </button>
      </div>

      <p className="px-1 text-[13px] text-muted">
        {total} {total === 1 ? "apunte" : "apuntes"} en {days.length} {days.length === 1 ? "noche" : "noches"}
        {(q || kind) && " (filtrado)"}
      </p>

      <ul className="space-y-2">
        {days.map((d, i) => (
          <li key={d.date}>
            <details open={i < 3} className="group overflow-hidden rounded-card bg-surface">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3">
                <span className="text-[15px] font-semibold">{d.title}</span>
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  {d.items.length}
                  <span aria-hidden className="transition-transform duration-150 ease-out group-open:rotate-90">
                    ›
                  </span>
                </span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {d.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-2 px-3 py-2 text-[15px]">
                    <span
                      className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: tint(it.color, 16), color: it.color }}
                    >
                      {it.label}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">
                      {it.who && <span className="font-semibold">{it.who} · </span>}
                      {it.time && <span className="text-muted">{it.time} · </span>}
                      {it.text}
                      {it.photos ? <span className="text-muted"> · 📷 {it.photos}</span> : null}
                    </span>
                    {onEditFileNote && it.ref?.type === "file-note" && (
                      <button
                        type="button"
                        onClick={() => onEditFileNote(it.ref!.id)}
                        className="-my-2 min-h-11 shrink-0 px-1 text-[14px] font-medium text-accent"
                      >
                        Editar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      {days.length === 0 && <p className="px-1 text-center text-[14px] text-muted">Nada con ese filtro.</p>}
    </div>
  );
}

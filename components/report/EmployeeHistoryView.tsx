"use client";

import { useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import { tint } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { type HistoryItem, KIND_META, groupHistory, historyCounts, historyToText } from "@/lib/employee-history";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Historial de un empleado por noche (desplegable), con búsqueda dentro y exportar. */
export function EmployeeHistoryView({ name, items, currentYear }: { name: string; items: HistoryItem[]; currentYear: number }) {
  const [q, setQ] = useState("");
  const days = useMemo(() => groupHistory(items, currentYear, q), [items, currentYear, q]);
  const counts = useMemo(() => historyCounts(days), [days]);
  const text = useMemo(() => historyToText(name, days), [name, days]);
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
    return <p className="px-1 py-4 text-center text-[15px] text-muted">No hay nada apuntado sobre {name}.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-label="Resumen">
        {counts.map((c) => (
          <span
            key={c.kind}
            className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: tint(KIND_META[c.kind].color, 16), color: KIND_META[c.kind].color }}
          >
            {KIND_META[c.kind].label} · {c.count}
          </span>
        ))}
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
        {q && " (filtrado)"}
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
                      className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide")}
                      style={{ backgroundColor: tint(it.color, 16), color: it.color }}
                    >
                      {it.label}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">
                      {it.time && <span className="text-muted">{it.time} · </span>}
                      {it.text}
                      {it.photos ? <span className="text-muted"> · 📷 {it.photos}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      {days.length === 0 && <p className="px-1 text-center text-[14px] text-muted">Nada coincide con «{q}».</p>}
    </div>
  );
}

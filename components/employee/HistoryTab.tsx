"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PhotoThumbs } from "@/components/reports/PhotoThumbs";
import { PhotoViewer } from "@/components/reports/PhotoViewer";
import { Chip } from "@/components/ui/Chip";
import { formatDayLong, formatStamp } from "@/lib/dates";
import {
  CATEGORY_META, NOTE_CATEGORIES, type NoteCategory, type NoteView, buildTimeline, filterTimeline, groupByMonth,
} from "@/lib/employee-file";
import type { ReportView } from "@/lib/report-format";
import { NoteSheet } from "./NoteSheet";

type Filter = NoteCategory | "REPORT" | null;

function CategoryTag({ category }: { category: NoteCategory }) {
  const m = CATEGORY_META[category];
  return (
    <span
      data-category={category}
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white"
      style={{ backgroundColor: m.color }}
    >
      {m.label}
    </span>
  );
}

function NoteItem({ note, onEdit }: { note: NoteView; onEdit: () => void }) {
  const [viewer, setViewer] = useState<number | null>(null);
  return (
    <article className="rounded-card bg-surface px-4 py-3" aria-label="Nota de ficha" data-testid="timeline-note">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-[14px] font-semibold tabular-nums">{formatStamp(new Date(note.occurredAt))}</span>
        <CategoryTag category={note.category} />
      </header>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px]">{note.text}</p>
      <PhotoThumbs photos={note.photos} onOpen={setViewer} label="Fotos de la nota" />
      <div className="mt-1 flex justify-end">
        <button type="button" onClick={onEdit} className="min-h-11 rounded-full px-3 text-[14px] font-medium text-accent">
          Editar
        </button>
      </div>
      <PhotoViewer photos={note.photos} index={viewer} caption={note.text} onClose={() => setViewer(null)} />
    </article>
  );
}

function ReportItem({ report, at }: { report: ReportView; at: string }) {
  const [viewer, setViewer] = useState<number | null>(null);
  return (
    <article className="rounded-card bg-surface px-4 py-3" aria-label="Aviso del día" data-testid="timeline-report">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-[14px] font-semibold tabular-nums">{formatStamp(new Date(at))}</span>
        <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold text-muted">
          Aviso del día
        </span>
      </header>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px]">{report.text}</p>
      <PhotoThumbs photos={report.photos} onOpen={setViewer} />
      <div className="mt-1 flex justify-end">
        <Link
          href={`/hoy/${report.date}`}
          className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-accent"
        >
          Ver noche del {formatDayLong(report.date).replace(/^\S+ /, "")}
        </Link>
      </div>
      <PhotoViewer photos={report.photos} index={viewer} caption={report.text} onClose={() => setViewer(null)} />
    </article>
  );
}

export function HistoryTab({
  employeeId,
  notes,
  reports,
}: {
  employeeId: string;
  notes: NoteView[];
  reports: ReportView[];
}) {
  const [filter, setFilter] = useState<Filter>(null);
  const [sheet, setSheet] = useState<{ open: boolean; noteId: string | null }>({ open: false, noteId: null });

  const all = useMemo(() => buildTimeline(notes, reports), [notes, reports]);
  const groups = useMemo(() => groupByMonth(filterTimeline(all, filter)), [all, filter]);
  const editing = sheet.noteId ? (notes.find((n) => n.id === sheet.noteId) ?? null) : null;

  const filters: { value: Filter; label: string }[] = [
    { value: null, label: "Todo" },
    ...NOTE_CATEGORIES.map((c) => ({ value: c as Filter, label: CATEGORY_META[c].label })),
    ...(reports.length > 0 ? [{ value: "REPORT" as Filter, label: "Avisos" }] : []),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Historial</h2>
        <button
          type="button"
          onClick={() => setSheet({ open: true, noteId: null })}
          className="min-h-11 rounded-full px-3 text-[16px] font-semibold text-accent"
        >
          + Nota
        </button>
      </div>

      {all.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {filters.map((f) => (
            <Chip
              key={f.label}
              selected={filter === f.value}
              color={f.value && f.value !== "REPORT" ? CATEGORY_META[f.value].color : undefined}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-8 text-center text-muted">
          Sin notas todavía. Apunta incidencias, felicitaciones o conversaciones con “+ Nota”.
        </p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-muted">Nada en esta categoría.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{g.label}</h3>
              <div className="flex flex-col gap-2">
                {g.items.map((it) =>
                  it.kind === "note" ? (
                    <NoteItem key={`n${it.note.id}`} note={it.note} onEdit={() => setSheet({ open: true, noteId: it.note.id })} />
                  ) : (
                    <ReportItem key={`r${it.report.id}`} report={it.report} at={it.at} />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <NoteSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        employeeId={employeeId}
        note={editing}
      />
    </div>
  );
}

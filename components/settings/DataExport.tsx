"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { MAX_EXPORT_DAYS, daysInRange } from "@/lib/export";
import { addDays, isDateStr } from "@/lib/dates";
import { backupNow } from "@/app/actions/backups";
import { formatBytes } from "@/lib/upload-rules";
import { formatDayLong } from "@/lib/dates";
import { BackHeader, Field, PrimaryButton, inputClass, useRun } from "./kit";

export interface BackupItem {
  name: string;
  date: string;
  size: number;
}

export function DataExport({
  today,
  backupToday,
  backups,
  blobMissing,
}: {
  today: string;
  /** Día (Madrid) de la copia de hoy. */
  backupToday: string;
  backups: BackupItem[];
  blobMissing?: boolean;
}) {
  const { pending, run } = useRun();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? backups : backups.slice(0, 5);
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);

  const valid = isDateStr(from) && isDateStr(to) && from <= to;
  const tooLong = valid && daysInRange(from, to).length > MAX_EXPORT_DAYS;
  const ok = valid && !tooLong;
  const href = `/api/export?from=${from}&to=${to}`;

  return (
    <div>
      <BackHeader title="Datos y fotos" />
      <Card title="Copias automáticas" className="mb-4">
        <p className="text-[14px] text-muted">
          Cada mañana (sobre las 10) se guarda una copia de toda la base de datos en el almacenamiento de la app, el mismo
          de las fotos. Se guardan los últimos 60 días.
        </p>
        {blobMissing && (
          <p role="alert" className="mt-2 text-[14px] font-medium text-danger">
            Falta conectar el almacenamiento (Vercel Blob): sin él no se pueden guardar copias.
          </p>
        )}
        {backups.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {shown.map((b) => (
              <li key={b.name}>
                <a href={`/api/backups/${b.name}`} download className="flex min-h-11 items-center justify-between gap-2 text-[15px]">
                  <span>
                    {formatDayLong(b.date)}
                    {b.date === backupToday && <span className="text-success"> · hoy</span>}
                  </span>
                  <span className="text-[13px] text-muted">{formatBytes(b.size)} ↓</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-muted">Todavía no hay ninguna copia guardada.</p>
        )}
        {backups.length > 5 && !showAll && (
          <button type="button" onClick={() => setShowAll(true)} className="min-h-11 text-[15px] font-medium text-accent">
            Ver las {backups.length}
          </button>
        )}
        <PrimaryButton
          className="mt-3 w-full"
          disabled={pending || blobMissing}
          onClick={() => run(() => backupNow(), { msg: "Copia guardada" })}
        >
          {pending ? "Guardando copia…" : "Hacer copia ahora"}
        </PrimaryButton>
      </Card>
      <Card title="Descargar copia al móvil" className="mb-4">
        <p className="text-[14px] text-muted">
          Descarga toda la base de datos (empleados, cuadrante, notas, nómina…) en un archivo para guardarlo en Archivos o
          en Drive.
        </p>
        <a
          href="/api/backup"
          download
          className="mt-3 flex min-h-12 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-fg active:opacity-80"
        >
          Descargar copia completa
        </a>
      </Card>
      <Card title="Exportar CSV">
        <p className="text-[14px] text-muted">
          Una fila por empleado y noche (incluye los días por defecto y los de fiesta fija). Separado por “;” para Excel.
        </p>
        <Field label="Desde">
          <input type="date" aria-label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Hasta">
          <input type="date" aria-label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </Field>
        {!valid && <p className="text-[13px] text-danger">Elige un rango válido.</p>}
        {tooLong && <p className="text-[13px] text-danger">Máximo {MAX_EXPORT_DAYS} días.</p>}
        <a
          href={ok ? href : undefined}
          aria-disabled={!ok}
          download
          className={`mt-3 flex min-h-11 items-center justify-center rounded-control bg-accent px-4 text-[16px] font-semibold text-accent-fg ${ok ? "" : "pointer-events-none opacity-40"}`}
        >
          Descargar CSV
        </a>
      </Card>
    </div>
  );
}

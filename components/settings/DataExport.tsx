"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { MAX_EXPORT_DAYS, daysInRange } from "@/lib/export";
import { addDays, isDateStr } from "@/lib/dates";
import { BackHeader, Field, inputClass } from "./kit";

export function DataExport({ today }: { today: string }) {
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);

  const valid = isDateStr(from) && isDateStr(to) && from <= to;
  const tooLong = valid && daysInRange(from, to).length > MAX_EXPORT_DAYS;
  const ok = valid && !tooLong;
  const href = `/api/export?from=${from}&to=${to}`;

  return (
    <div>
      <BackHeader title="Datos y fotos" />
      <Card title="Copia de seguridad" className="mb-4">
        <p className="text-[14px] text-muted">
          Descarga toda la base de datos (empleados, cuadrante, notas, nómina…) en un archivo. Guárdalo en Archivos o en
          Drive. Además se hace una copia automática cada mañana a las 9.
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

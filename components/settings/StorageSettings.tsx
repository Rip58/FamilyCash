"use client";

import { useState } from "react";
import { purgeOldReports } from "@/app/actions/reports";
import { Card } from "@/components/ui/Card";
import { formatBytes } from "@/lib/upload-rules";
import { photoCountLabel } from "@/lib/reports";
import { BackHeader, ConfirmButton, Stepper, useRun } from "./kit";

interface Props {
  reports: number;
  /** Notas de ficha de empleado. */
  notes: number;
  /** Fotos totales (avisos + fichas). */
  photos: number;
  reportPhotos: number;
  notePhotos: number;
  bytes: number;
  mode: "blob" | "local";
}

export function StorageSettings({ reports, notes, photos, reportPhotos, notePhotos, bytes, mode }: Props) {
  const [months, setMonths] = useState(6);
  const { pending, run } = useRun();

  const row = "flex min-h-11 items-center justify-between border-b border-line py-2 last:border-b-0";
  return (
    <div>
      <BackHeader title="Almacenamiento" />
      <Card title="Fotos guardadas">
        <dl>
          <div className={row}>
            <dt>Avisos</dt>
            <dd className="font-semibold tabular-nums" data-testid="stat-reports">{reports}</dd>
          </div>
          <div className={row}>
            <dt>Notas de ficha</dt>
            <dd className="font-semibold tabular-nums" data-testid="stat-notes">{notes}</dd>
          </div>
          <div className={row}>
            <dt>Fotos</dt>
            <dd className="font-semibold tabular-nums" data-testid="stat-photos">{photos}</dd>
          </div>
          <div className={row}>
            <dt>Espacio aproximado</dt>
            <dd className="font-semibold tabular-nums" data-testid="stat-size">{formatBytes(bytes)}</dd>
          </div>
          <div className={row}>
            <dt>Almacén</dt>
            <dd className="text-muted">{mode === "blob" ? "Vercel Blob" : "Local (desarrollo)"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[13px] text-muted">
          Las fotos se comprimen (máx. 1600 px) antes de subirlas: unos 300 KB cada una.
        </p>
      </Card>

      <Card title="Limpieza" className="mt-4">
        <p className="text-[14px] text-muted">
          Borra los avisos de noches anteriores a N meses, junto con sus fotos. Las notas de ficha de los
          empleados no se borran nunca desde aquí. No se puede deshacer.
        </p>
        <div className="my-3 flex items-center justify-between gap-3">
          <span className="text-[16px]">Anteriores a</span>
          <div className="flex items-center gap-2">
            <Stepper label="Meses" value={months} onChange={setMonths} min={1} max={120} />
            <span className="text-[16px]">{months === 1 ? "mes" : "meses"}</span>
          </div>
        </div>
        <ConfirmButton
          label={`Borrar avisos anteriores a ${months} ${months === 1 ? "mes" : "meses"}`}
          confirmLabel="Sí, borrar avisos y fotos"
          disabled={pending || reports === 0}
          onConfirm={() =>
            run(() => purgeOldReports({ months }), { msg: "Avisos anteriores borrados" })
          }
        />
        {reports === 0 && <p className="mt-2 text-[13px] text-muted">No hay avisos guardados.</p>}
      </Card>
      <p className="mt-3 px-1 text-[12px] text-muted">
        {photoCountLabel(reportPhotos)} en {reports} {reports === 1 ? "aviso" : "avisos"} y {photoCountLabel(notePhotos)} en{" "}
        {notes} {notes === 1 ? "nota de ficha" : "notas de ficha"}.
      </p>
    </div>
  );
}

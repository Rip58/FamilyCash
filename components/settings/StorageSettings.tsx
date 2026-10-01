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
  /** Fotos de lineales y de pasos de protocolo. */
  protocolPhotos: number;
  bytes: number;
  mode: "blob" | "local";
  /** Publicada en Vercel sin Blob conectado: no se pueden subir fotos. */
  blobMissing?: boolean;
}

export function StorageSettings({ reports, notes, photos, reportPhotos, notePhotos, protocolPhotos, bytes, mode, blobMissing }: Props) {
  const [months, setMonths] = useState(6);
  const { pending, run } = useRun();

  const row = "flex min-h-11 items-center justify-between border-b border-line py-2 last:border-b-0";
  return (
    <div>
      <BackHeader title="Almacenamiento" />
      {blobMissing && (
        <div role="alert" className="mb-4 rounded-card bg-danger/10 p-4 text-[15px] text-danger">
          <p className="font-semibold">No se pueden subir fotos</p>
          <p className="mt-1">
            Falta conectar Vercel Blob: en vercel.com → proyecto → Storage → Create → Blob, conéctalo a este
            proyecto y vuelve a publicar.
          </p>
        </div>
      )}
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
            <dd className={blobMissing ? "font-semibold text-danger" : "text-muted"}>
              {mode === "blob" ? "Vercel Blob" : blobMissing ? "Sin configurar" : "Local (desarrollo)"}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[13px] text-muted">
          Las fotos se guardan en WebP (calidad 85, máx. 1600 px): como mucho 300 KB cada una.
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
        {notes} {notes === 1 ? "nota de ficha" : "notas de ficha"}
        {protocolPhotos > 0 && `, y ${photoCountLabel(protocolPhotos)} en lineales y protocolos (no se borran desde aquí)`}.
      </p>
    </div>
  );
}

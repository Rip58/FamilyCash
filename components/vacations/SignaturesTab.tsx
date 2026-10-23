"use client";

import { useEffect, useState } from "react";
import { type SignedSheetRow, getSignedSheets } from "@/app/actions/vacations";
import { cn } from "@/components/ui/cn";
import { notify } from "@/components/ui/toast";
import { formatStamp } from "@/lib/dates";
import { renderVacationPdf } from "@/lib/vacation-pdf";
import { countedDays, rangeLabel } from "@/lib/vacations";

const STATE_STYLE: Record<SignedSheetRow["state"], string> = {
  Firmada: "bg-success/15 text-[#15803d]",
  "Falta firmar": "bg-warning/15 text-[#b45309]",
  "En revisión": "bg-accent/12 text-accent",
  "Sin enviar": "bg-surface-2 text-muted",
};

/** Comparte o descarga un PDF (la hoja de compartir del móvil si la hay). */
export async function sharePdf(pdf: Blob, name: string) {
  const file = new File([pdf], name, { type: "application/pdf" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** PDF de vacaciones firmadas: de todos (con resumen) o de una persona. */
export async function makeVacationPdf(year: number, workDays: number, employeeId?: string): Promise<boolean> {
  const r = await getSignedSheets({ year, employeeId: employeeId ?? null });
  if (!r.ok) {
    notify(r.error, "error");
    return false;
  }
  const rows = r.rows;
  const { pdf } = await renderVacationPdf(rows, {
    year,
    workDays,
    generated: formatStamp(new Date()),
    title: `Vacaciones ${year}`,
  });
  const name = employeeId && rows[0] ? `vacaciones-${year}-${rows[0].name.toLowerCase().replace(/\s+/g, "-")}.pdf` : `vacaciones-${year}-firmas.pdf`;
  await sharePdf(pdf, name);
  return true;
}

/** Pestaña «Firmas»: quién ha firmado, a quién le falta y el PDF con todas las hojas. */
export function SignaturesTab({ year, workDays, onPerson }: { year: number; workDays: number; onPerson: (id: string, name: string) => void }) {
  const [rows, setRows] = useState<SignedSheetRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getSignedSheets({ year })
      .then((r) => alive && setRows(r.ok ? r.rows : []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [year]);

  if (!rows) return <p className="py-10 text-center text-[15px] text-muted">Cargando…</p>;
  const signed = rows.filter((r) => r.state === "Firmada").length;

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
        <p className="text-[15px]">
          <b className="text-[22px] tabular-nums">{signed}</b> de {rows.length} han firmado
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await makeVacationPdf(year, workDays);
            } catch {
              notify("No se pudo crear el PDF", "error");
            } finally {
              setBusy(false);
            }
          }}
          className="press min-h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Preparando PDF…" : "PDF con todas las firmas"}
        </button>
        <p className="text-[13px] text-muted">Una página de resumen con todos y una hoja por cada persona que ha firmado, con sus fechas y su firma.</p>
      </section>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface" aria-label="Firmas">
        {rows.map((r) => (
          <li key={r.employeeId}>
            <button
              type="button"
              onClick={() => onPerson(r.employeeId, r.name)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-medium">{r.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {r.ranges.length ? `${r.ranges.map(rangeLabel).join(", ")} · ${countedDays(r.ranges)}/${workDays}` : "Sin vacaciones"}
                  {r.signedAt && ` · firmado ${r.signedAt}`}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold", STATE_STYLE[r.state])}>{r.state}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

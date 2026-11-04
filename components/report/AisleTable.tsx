import { tint } from "@/components/ui/icons";
import type { SharePallets, ShareAisle } from "@/lib/report-share";

const GRID = "grid grid-cols-[5.3rem_minmax(0,1fr)_1.9rem_2.6rem_1.9rem_2.7rem] gap-x-1";
const num = (n: number | null) => (n === null ? "–" : String(n));

/**
 * Tabla de pasillos de la noche (como una hoja de Excel): pasillo, personas, palés subidos / bajados / hechos y hora;
 * la nota de cada pasillo va debajo de su fila. Sale en el Informe.
 */
export function AisleTable({ aisles, pallets }: { aisles: ShareAisle[]; pallets: SharePallets | null }) {
  return (
    <div role="table" aria-label="Pasillos" className="-mx-2 text-[13px] leading-tight">
      <div role="row" className={`${GRID} border-b border-line pb-1.5 pl-[9px] text-[10px] font-semibold uppercase text-muted`}>
        <span role="columnheader">Pasillo</span>
        <span role="columnheader">Personas</span>
        <span role="columnheader" className="text-center">Sub.</span>
        <span role="columnheader" className="text-center">Baj.</span>
        <span role="columnheader" className="text-center">Hec.</span>
        <span role="columnheader" className="text-center">Hora</span>
      </div>
      {aisles.map((a) => (
        <div key={`${a.parent ?? ""}/${a.name}`} role="rowgroup" className="border-b border-line border-l-[3px] py-1.5 pl-1.5" style={{ borderLeftColor: a.color }}>
          <div role="row" className={`${GRID} items-start`}>
            <span role="cell" className="min-w-0 break-words font-semibold">
              {a.name}
              {a.parent && <span className="block text-[10px] font-medium text-muted">{a.parent}</span>}
            </span>
            <span role="cell" className="min-w-0 break-words">{a.people.join(", ") || "Grupo"}</span>
            <span role="cell" className="text-center font-semibold tabular-nums">{num(a.up)}</span>
            <span role="cell" className="text-center tabular-nums">
              <span className="font-semibold">{num(a.down)}</span>
              {a.surplus !== null && <span className="block text-[10px] font-medium text-muted">+{a.surplus} sobr.</span>}
            </span>
            <span role="cell" className="text-center font-bold tabular-nums text-success">{num(a.done)}</span>
            <span role="cell" className="text-center tabular-nums">
              {a.startTime ?? "–"}
              {a.endTime && <span className="block text-[10px] font-medium text-muted">a {a.endTime}</span>}
            </span>
          </div>
          {a.note && (
            <p className="mt-1 rounded-control px-2 py-1 text-[12px] text-muted" style={{ backgroundColor: tint(a.color, 12) }}>
              <span className="font-semibold">Nota:</span> {a.note}
            </p>
          )}
        </div>
      ))}
      {pallets && (
        <div role="row" className={`${GRID} items-start pl-[9px] pt-1.5 font-bold tabular-nums`}>
          <span role="cell">Total</span>
          <span role="cell" />
          <span role="cell" className="text-center">{pallets.up}</span>
          <span role="cell" className="text-center">
            {pallets.down}
            {pallets.surplus > 0 && <span className="block text-[10px] font-medium text-muted">+{pallets.surplus} sobr.</span>}
          </span>
          <span role="cell" className="text-center text-success">{pallets.done}</span>
          <span role="cell" />
        </div>
      )}
      <p className="mt-2 px-2 text-[11px] leading-snug text-muted">
        Sub. = subidos · Baj. = bajados sin tocar (+ sobrante, que cuenta como hecho) · Hec. = hechos (subidos − sin tocar).
      </p>
    </div>
  );
}

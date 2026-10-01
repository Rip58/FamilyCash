"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { StatusTypeLite } from "@/lib/schedule";

interface AbsentSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  /** Estado previsto en la Semana (normalmente Trabaja). */
  planned: StatusTypeLite;
  statusTypes: StatusTypeLite[];
  onConfirm: (statusTypeId: string, reason: string | null) => void;
}

/** Primero Fiesta y Baja (lo más habitual), luego el resto en su orden. */
const FIRST = ["OFF", "SICK"];

/** Al marcar ✗: un toque en el motivo lo guarda; cambia también la Semana. */
export function AbsentSheet({ open, onClose, name, planned, statusTypes, onConfirm }: AbsentSheetProps) {
  const [reason, setReason] = useState("");
  const options = statusTypes
    .filter((s) => !s.isWorking && s.active !== false)
    .sort((a, b) => {
      const ia = FIRST.indexOf(a.code);
      const ib = FIRST.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.sortOrder - b.sortOrder;
    });

  return (
    <BottomSheet open={open} onClose={onClose} title={`${name} no está hoy`}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[14px] text-muted">
          ¿Por qué? Se cambiará también en la Semana ({planned.label} → lo que elijas).
        </p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onConfirm(s.id, reason.trim() || null);
                onClose();
              }}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-card border-2 px-3 text-[16px] font-semibold active:opacity-70 ${
                i < FIRST.length ? "" : "text-[15px] font-medium"
              }`}
              style={{ borderColor: s.color, backgroundColor: `${s.color}22` }}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Motivo (opcional, escríbelo antes de elegir)</span>
          <input
            type="text"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: médico, cambio de fiesta…"
            className="min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button type="button" onClick={onClose} className="min-h-11 text-[16px] font-medium text-accent">
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}

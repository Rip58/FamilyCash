"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
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

/** Aviso al marcar ✗: cambia el estado del día también en la Semana. */
export function AbsentSheet({ open, onClose, name, planned, statusTypes, onConfirm }: AbsentSheetProps) {
  const options = statusTypes.filter((s) => !s.isWorking && s.active !== false);
  const initial = options.find((s) => s.code === "ABSENT") ?? options[0];
  const [statusId, setStatusId] = useState(initial?.id ?? "");
  const [reason, setReason] = useState("");
  const chosen = options.find((s) => s.id === statusId);

  return (
    <BottomSheet open={open} onClose={onClose} title={`${name} no ha venido`}>
      <div className="flex flex-col gap-4 pb-2">
        <p role="alert" className="rounded-control bg-warning/20 px-3 py-2 text-[14px] font-medium text-[#92600a] dark:text-warning">
          Se cambiará también en la Semana: {planned.label} → {chosen?.label ?? "—"}.
        </p>
        <Segmented
          wrap
          aria-label="Motivo de la ausencia"
          value={statusId}
          onChange={setStatusId}
          options={options.map((s) => ({ value: s.id, label: s.label, color: s.color }))}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Motivo (opcional)</span>
          <input
            type="text"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: no avisa, médico…"
            className="min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => {
            onConfirm(statusId, reason.trim() || null);
            onClose();
          }}
          className="min-h-11 rounded-control bg-danger text-[16px] font-semibold text-white disabled:opacity-40"
        >
          Marcar {chosen ? chosen.label.toLowerCase() : "ausencia"}
        </button>
        <button type="button" onClick={onClose} className="min-h-11 text-[16px] font-medium text-accent">
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}

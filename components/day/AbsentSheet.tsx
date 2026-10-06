"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { StatusTypeLite } from "@/lib/schedule";
import { NoticeToggle } from "./NoticeToggle";
import { StatusButtons } from "./StatusButtons";

interface AbsentSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto de ayuda bajo el título. */
  note?: React.ReactNode;
  /** Estado actual (se marca como elegido). */
  current?: string | null;
  statusTypes: StatusTypeLite[];
  onConfirm: (statusTypeId: string, reason: string | null, notified: boolean | null) => void;
  /** Pregunta «¿Ha avisado?» (cuando no ha venido a un día de trabajo). */
  askNotice?: boolean;
  /** Si se indica, muestra arriba "Ha venido a trabajar" (para quien el planning daba ausente). */
  onCame?: () => void;
}

/** Primero Fiesta y Baja (lo más habitual), luego el resto en su orden. */
const FIRST = ["OFF", "SICK"];

/** Elegir el motivo de una ausencia: un toque lo guarda (cambia también la Semana). */
export function AbsentSheet({ open, onClose, title, note, current, statusTypes, onConfirm, onCame, askNotice }: AbsentSheetProps) {
  const [reason, setReason] = useState("");
  const [notified, setNotified] = useState<boolean | null>(null);
  const options = statusTypes
    .filter((s) => !s.isWorking && (s.active !== false || s.id === current))
    .sort((a, b) => {
      const ia = FIRST.indexOf(a.code);
      const ib = FIRST.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.sortOrder - b.sortOrder;
    });

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 pb-2">
        {note && <p className="text-[14px] text-muted">{note}</p>}
        {onCame && (
          <button
            type="button"
            onClick={() => {
              onCame();
              onClose();
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-control border-2 border-success bg-success/10 text-[16px] font-semibold text-success"
          >
            ✓ Ha venido a trabajar
          </button>
        )}
        {askNotice && <NoticeToggle value={notified} onChange={setNotified} />}
        <StatusButtons
          statuses={options}
          value={current}
          onPick={(s) => {
            onConfirm(s.id, reason.trim() || null, notified);
            onClose();
          }}
        />
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

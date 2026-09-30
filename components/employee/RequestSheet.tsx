"use client";

import { useState } from "react";
import { createRequest, updateRequest } from "@/app/actions/employee-file";
import { PrimaryButton, inputClass, useRun } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { madridToday } from "@/lib/dates";
import type { RequestView } from "@/lib/employee-file";
import {
  LEAVE_TYPES, LEAVE_TYPE_LABEL, type LeaveType, summarizeRequest, validateLeaveDates,
} from "@/lib/leave";

interface RequestSheetProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  /** Petición pendiente a editar; null = nueva. */
  request: RequestView | null;
}

export function RequestSheet({ open, onClose, employeeId, request }: RequestSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={request ? "Editar petición" : "Nueva petición"}>
      {open && <RequestForm key={request?.id ?? "new"} employeeId={employeeId} request={request} onClose={onClose} />}
    </BottomSheet>
  );
}

const TYPE_OPTIONS = LEAVE_TYPES.map((t) => ({
  value: t,
  label: t === "PAID_OFF" ? "Permiso" : LEAVE_TYPE_LABEL[t],
}));

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <input type="date" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} min-w-0`} />
    </label>
  );
}

function RequestForm({ employeeId, request, onClose }: { employeeId: string; request: RequestView | null; onClose: () => void }) {
  const today = madridToday();
  const [type, setType] = useState<LeaveType>(request?.type ?? "VACATION");
  const [from, setFrom] = useState<string>(request?.dateFrom ?? today);
  const [to, setTo] = useState<string>(request?.dateTo ?? today);
  const [note, setNote] = useState(request?.note ?? "");
  const [requestedAt, setRequestedAt] = useState<string>(request?.requestedAt ?? today);
  const { pending, run } = useRun();

  const swap = type === "SWAP_OFF";
  const error = validateLeaveDates(type, from, to);
  const summary = !error ? summarizeRequest({ type, dateFrom: from, dateTo: to }) : null;
  const canSave = !error && /^\d{4}-\d{2}-\d{2}$/.test(requestedAt) && !pending;

  const changeFrom = (v: string) => {
    setFrom(v);
    if (!swap && v && to < v) setTo(v);
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      <Segmented wrap aria-label="Tipo de petición" value={type} onChange={setType} options={TYPE_OPTIONS} />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <DateField label={swap ? "Deja de librar (A)" : "Desde"} value={from} onChange={changeFrom} />
        <DateField label={swap ? "Pasa a librar (B)" : "Hasta"} value={to} onChange={setTo} />
      </div>
      {swap && <p className="-mt-2 text-[13px] text-muted">Al aprobar: el día A pasa a Trabaja y el día B a Fiesta.</p>}
      {type === "OTHER" && <p className="-mt-2 text-[13px] text-muted">No cambia el calendario: solo queda registrada.</p>}

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">{error}</p>
      ) : (
        <p className="text-[14px] font-medium" data-testid="request-summary">{summary}</p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">Nota (opcional)</span>
        <textarea
          aria-label="Nota de la petición"
          value={note}
          rows={3}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivo, condiciones acordadas…"
          className={`${inputClass} py-2`}
        />
      </label>

      <DateField label="Fecha de la petición" value={requestedAt} onChange={setRequestedAt} />

      <PrimaryButton
        disabled={!canSave}
        onClick={() =>
          run(
            () => {
              const base = { type, dateFrom: from, dateTo: to, note, requestedAt };
              return request ? updateRequest({ id: request.id, ...base }) : createRequest({ employeeId, ...base });
            },
            { msg: request ? "Petición actualizada" : "Petición creada", onDone: onClose },
          )
        }
      >
        {pending ? "Guardando…" : request ? "Guardar cambios" : "Crear petición"}
      </PrimaryButton>
    </div>
  );
}

"use client";

import { useState } from "react";
import { approveRequest, deleteRequest, denyRequest, previewApproval, revertRequest, type ApprovalPreview } from "@/app/actions/employee-file";
import { ConfirmButton, PrimaryButton, inputClass, notify, useRun } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { formatDayLong, formatDayMonth } from "@/lib/dates";
import { type RequestView, sortRequests } from "@/lib/employee-file";
import { LEAVE_TYPE_LABEL, daysLabel, summarizeRequest } from "@/lib/leave";
import { RequestStatusPill } from "./pills";
import { RequestSheet } from "./RequestSheet";

const btn = "min-h-11 flex-1 rounded-control px-3 text-[15px] font-semibold disabled:opacity-40";

export function RequestsTab({ employeeId, requests }: { employeeId: string; requests: RequestView[] }) {
  const [form, setForm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [approval, setApproval] = useState<{ request: RequestView; preview: ApprovalPreview } | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [denying, setDenying] = useState<RequestView | null>(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const { pending, run } = useRun();

  const sorted = sortRequests(requests);
  const editing = form.id ? (requests.find((r) => r.id === form.id) ?? null) : null;

  async function startApproval(r: RequestView) {
    const res = await previewApproval({ id: r.id });
    if (!res.ok) {
      notify(res.error, "error");
      return;
    }
    setApproval({ request: r, preview: res.preview });
    setApprovalOpen(true);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Peticiones</h2>
        <button
          type="button"
          onClick={() => setForm({ open: true, id: null })}
          className="min-h-11 rounded-full px-3 text-[16px] font-semibold text-accent"
        >
          + Petición
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-8 text-center text-muted">
          Sin peticiones. Registra cambios de fiesta, vacaciones o permisos con “+ Petición”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((r) => (
            <li key={r.id} className="rounded-card bg-surface px-4 py-3" data-testid="request-card" data-status={r.status}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] text-muted">{LEAVE_TYPE_LABEL[r.type]}</div>
                  <div className="text-[16px] font-semibold leading-snug">{summarizeRequest(r)}</div>
                </div>
                <RequestStatusPill status={r.status} className="shrink-0" />
              </div>
              {r.note && <p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{r.note}</p>}
              <p className="mt-1 text-[12px] text-muted">
                Pedida el {formatDayMonth(r.requestedAt)}
                {r.status === "APPROVED" && r.appliedCount > 0 ? ` · ${daysLabel(r.appliedCount)} en el calendario` : ""}
                {r.status === "DENIED" && r.decisionNote ? ` · Motivo: ${r.decisionNote}` : ""}
              </p>

              {r.status === "PENDING" && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button type="button" disabled={pending} onClick={() => void startApproval(r)} className={cn(btn, "bg-accent text-accent-fg")}>
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDenying(r);
                        setDenyOpen(true);
                      }}
                      className={cn(btn, "bg-surface-2")}
                    >
                      Denegar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm({ open: true, id: r.id })} className={cn(btn, "bg-surface-2 font-medium text-accent")}>
                      Editar
                    </button>
                    <div className="flex-1">
                      <ConfirmButton
                        label="Borrar"
                        confirmLabel="Sí, borrar"
                        disabled={pending}
                        onConfirm={() => run(() => deleteRequest({ id: r.id }), { msg: "Petición borrada" })}
                      />
                    </div>
                  </div>
                </div>
              )}
              {r.status === "APPROVED" && (
                <div className="mt-2">
                  <ConfirmButton
                    label="Revertir aprobación"
                    confirmLabel="Sí, revertir"
                    disabled={pending}
                    onConfirm={() =>
                      run(() => revertRequest({ id: r.id }), { msg: "Aprobación revertida: la petición vuelve a pendiente" })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <RequestSheet open={form.open} onClose={() => setForm((f) => ({ ...f, open: false }))} employeeId={employeeId} request={editing} />

      <BottomSheet open={approvalOpen} onClose={() => setApprovalOpen(false)} title="Aprobar petición">
        {approval && (
          <ApprovalBody
            request={approval.request}
            preview={approval.preview}
            pending={pending}
            onConfirm={() =>
              run(() => approveRequest({ id: approval.request.id }), {
                msg: approval.preview.noCalendarChanges ? "Petición aprobada" : "Aprobada y aplicada al calendario",
                onDone: () => setApprovalOpen(false),
              })
            }
          />
        )}
      </BottomSheet>

      <BottomSheet open={denyOpen} onClose={() => setDenyOpen(false)} title="Denegar petición">
        {denying && (
          <DenyBody
            key={denying.id}
            request={denying}
            pending={pending}
            onConfirm={(decisionNote) =>
              run(() => denyRequest({ id: denying.id, decisionNote }), { msg: "Petición denegada", onDone: () => setDenyOpen(false) })
            }
          />
        )}
      </BottomSheet>
    </div>
  );
}

function ApprovalBody({
  request,
  preview,
  pending,
  onConfirm,
}: {
  request: RequestView;
  preview: ApprovalPreview;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2" data-testid="approval-sheet">
      <p className="text-[16px] font-semibold">{summarizeRequest(request)}</p>

      {preview.noCalendarChanges ? (
        <p className="rounded-control bg-surface-2 px-3 py-2 text-[14px]">
          {request.type === "OTHER"
            ? "Esta petición no cambia el calendario."
            : "El calendario ya está así: no hay días que cambiar."}
        </p>
      ) : (
        <section aria-label="Días afectados">
          <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Días afectados · {preview.changes.length}
          </h3>
          <ul className="divide-y divide-line rounded-control bg-surface-2">
            {preview.changes.map((c) => (
              <li key={c.date} className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5 text-[14px]">
                <span>{formatDayLong(c.date)}</span>
                <span className="text-muted">
                  {c.fromLabel} → <span className="font-semibold text-fg">{c.toLabel}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.conflicts.length > 0 && (
        <section aria-label="Conflictos" className="rounded-control border border-warning px-3 py-2" data-testid="approval-conflicts">
          <h3 className="text-[14px] font-semibold">Se sobrescribirá un estado ya marcado</h3>
          <ul className="mt-1 text-[14px]">
            {preview.conflicts.map((c) => (
              <li key={c.date}>
                {formatDayLong(c.date)}: ahora “{c.statusLabel}”
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.issues.length > 0 && (
        <section aria-label="Cobertura" className="rounded-control border border-dashed border-danger px-3 py-2" data-testid="approval-coverage">
          <h3 className="text-[14px] font-semibold text-danger">Cobertura del departamento</h3>
          <ul className="mt-1 text-[14px]">
            {preview.issues.map((i) => (
              <li key={`${i.date}-${i.departmentId}`}>
                {formatDayLong(i.date)}: {i.departmentName}{" "}
                {i.kind === "empty" ? "se queda sin personal" : `baja a ${i.after} de ${i.target} plazas`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <PrimaryButton disabled={pending} onClick={onConfirm}>
        {pending ? "Aprobando…" : preview.noCalendarChanges ? "Aprobar" : "Aprobar y aplicar al calendario"}
      </PrimaryButton>
    </div>
  );
}

function DenyBody({
  request,
  pending,
  onConfirm,
}: {
  request: RequestView;
  pending: boolean;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-4 pb-2">
      <p className="text-[16px] font-semibold">{summarizeRequest(request)}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">Motivo (opcional)</span>
        <textarea
          aria-label="Motivo de la denegación"
          value={note}
          rows={3}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: ya hay dos personas de vacaciones esa semana"
          className={`${inputClass} py-2`}
        />
      </label>
      <PrimaryButton disabled={pending} onClick={() => onConfirm(note)} className="!bg-danger !text-white">
        {pending ? "Denegando…" : "Denegar petición"}
      </PrimaryButton>
    </div>
  );
}

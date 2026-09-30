"use client";

import Link from "next/link";
import { useState } from "react";
import { BackHeader } from "@/components/settings/kit";
import { Segmented } from "@/components/ui/Segmented";
import { formatDayMonth } from "@/lib/dates";
import { type RequestView, sortRequests } from "@/lib/employee-file";
import { LEAVE_TYPE_LABEL, summarizeRequest } from "@/lib/leave";
import { RequestStatusPill } from "./pills";

/** Listado global de peticiones (Ajustes → Peticiones): cada fila abre la ficha. */
export function PendingRequestsList({ requests }: { requests: RequestView[] }) {
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const list = sortRequests(filter === "PENDING" ? requests.filter((r) => r.status === "PENDING") : requests);

  return (
    <div>
      <BackHeader title="Peticiones" />
      <Segmented
        aria-label="Filtro"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "PENDING", label: `Pendientes · ${pendingCount}` },
          { value: "ALL", label: `Todas · ${requests.length}` },
        ]}
      />
      {list.length === 0 ? (
        <p className="py-10 text-center text-muted">
          {filter === "PENDING" ? "No hay peticiones pendientes." : "Todavía no hay peticiones."}
        </p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-card bg-surface">
          {list.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/ajustes/empleados/${r.employeeId}?tab=peticiones`}
                data-testid="global-request"
                data-status={r.status}
                className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{r.employeeName}</span>
                  <span className="block text-[14px]">{summarizeRequest(r)}</span>
                  <span className="block text-[12px] text-muted">
                    {LEAVE_TYPE_LABEL[r.type]} · pedida el {formatDayMonth(r.requestedAt)}
                  </span>
                </span>
                <RequestStatusPill status={r.status} className="shrink-0" />
                <span aria-hidden className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

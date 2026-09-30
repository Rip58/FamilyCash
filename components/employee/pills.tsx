import { cn } from "@/components/ui/cn";
import { LEAVE_STATUS_LABEL, type LeaveStatus } from "@/lib/leave";

const STATUS_CLASS: Record<LeaveStatus, string> = {
  PENDING: "bg-warning/20 text-[#92600a] dark:text-warning",
  APPROVED: "bg-success/20 text-[#15803d] dark:text-success",
  DENIED: "bg-surface-2 text-muted",
};

/** Estado de una petición: Pendiente ámbar / Aprobada verde / Denegada gris. */
export function RequestStatusPill({ status, className }: { status: LeaveStatus; className?: string }) {
  return (
    <span
      data-status={status}
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATUS_CLASS[status], className)}
    >
      {LEAVE_STATUS_LABEL[status]}
    </span>
  );
}

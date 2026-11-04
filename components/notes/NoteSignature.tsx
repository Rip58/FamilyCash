import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import { formatStamp } from "@/lib/dates";
import { AGREEMENT_LABEL, type NoteView } from "@/lib/notes";

/**
 * Cómo está una notificación: sin firmar, o su conformidad («Conforme» en verde / «No conforme» en rojo) con la firma
 * del empleado debajo y quién y cuándo firmó. Sale en la lista de notas, el informe y el historial.
 */
export function NoteSignature({ note, size = "sm" }: { note: Pick<NoteView, "type" | "agreement" | "signature" | "signedAt" | "signedByName">; size?: "sm" | "lg" }) {
  if (note.type !== "NOTIFICATION") return null;
  if (!note.signedAt || !note.agreement) {
    return <span className="mt-0.5 inline-block rounded bg-warning/15 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-warning">Pendiente de firma</span>;
  }
  const good = note.agreement === "AGREE";
  return (
    <span className="mt-1 flex items-end gap-2.5" data-testid="note-signature">
      {note.signature && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={note.signature}
          alt={`Firma${note.signedByName ? ` de ${note.signedByName}` : ""}`}
          className={cn("w-auto shrink-0 rounded-control border border-line bg-white", size === "lg" ? "h-16" : "h-11")}
        />
      )}
      <span className="min-w-0 leading-tight">
        <span className={cn("flex items-center gap-1 text-[13px] font-bold", good ? "text-success" : "text-danger")}>
          <Icon name={good ? "check" : "close"} className="h-4 w-4" strokeWidth={2.8} />
          {AGREEMENT_LABEL[note.agreement]}
        </span>
        <span className="block text-[11px] text-muted">
          {note.signedByName ? `${note.signedByName} · ` : ""}
          {formatStamp(new Date(note.signedAt))}
        </span>
      </span>
    </span>
  );
}

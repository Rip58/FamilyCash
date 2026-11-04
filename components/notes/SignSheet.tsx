"use client";

import { useRef, useState } from "react";
import { SignaturePad, type SignaturePadHandle } from "@/components/vacations/SignaturePad";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import { AGREEMENT_LABEL, type Agreement } from "@/lib/notes";

export interface SignResult {
  signature: string;
  agreement: Agreement;
  signedById: string;
}

/**
 * Pop-up para que el empleado firme una notificación: lee lo que se le notifica, elige «Conforme» o «No conforme»,
 * firma con el dedo y «Firmar y guardar» (la nota se guarda ya firmada). Si la notificación es de varias personas,
 * se elige quién firma.
 */
export function SignSheet({
  open,
  onClose,
  text,
  signers,
  onSign,
}: {
  open: boolean;
  onClose: () => void;
  /** Lo que se notifica (se enseña antes de firmar). */
  text: string;
  /** Empleados de la notificación (el primero firma por defecto). */
  signers: { id: string; name: string }[];
  /** Guarda la nota firmada; devuelve un error (texto) o null si todo fue bien. */
  onSign: (r: SignResult) => Promise<string | null>;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Firma del empleado">
      {open && <SignForm text={text} signers={signers} onSign={onSign} />}
    </BottomSheet>
  );
}

function SignForm({ text, signers, onSign }: { text: string; signers: { id: string; name: string }[]; onSign: (r: SignResult) => Promise<string | null> }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [signer, setSigner] = useState(signers[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signerName = signers.find((s) => s.id === signer)?.name ?? "";

  async function submit() {
    const signature = pad.current?.toDataUrl();
    if (!signature || !agreement || !signer) return;
    setPending(true);
    setError(null);
    const err = await onSign({ signature, agreement, signedById: signer });
    setPending(false);
    if (err) setError(err);
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <section aria-label="Lo que se notifica" className="rounded-card bg-surface-2 px-3 py-2.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Notificación{signerName && ` a ${signerName}`}</p>
        <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[15px] leading-snug">{text}</p>
      </section>

      {signers.length > 1 && (
        <div role="radiogroup" aria-label="Quién firma" className="flex flex-wrap gap-1.5">
          {signers.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={signer === s.id}
              onClick={() => setSigner(s.id)}
              className={cn("press h-9 rounded-full px-3 text-[14px] font-medium", signer === s.id ? "bg-accent text-accent-fg" : "bg-surface-2")}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div role="radiogroup" aria-label="Conformidad" className="grid grid-cols-2 gap-2">
        {(["AGREE", "DISAGREE"] as const).map((a) => {
          const on = agreement === a;
          const good = a === "AGREE";
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAgreement(a)}
              className={cn(
                "press flex min-h-12 items-center justify-center gap-1.5 rounded-control text-[16px] font-semibold",
                on ? (good ? "bg-success text-white" : "bg-danger text-white") : "bg-surface-2",
              )}
            >
              <Icon name={good ? "check" : "close"} className="h-5 w-5" strokeWidth={2.6} />
              {AGREEMENT_LABEL[a]}
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-1 text-[13px] text-muted">{signerName ? `${signerName}, firma aquí con el dedo:` : "Firma aquí con el dedo:"}</p>
        <SignaturePad ref={pad} onChange={setHasInk} />
      </div>

      {error && (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={() => pad.current?.clear()} className="press min-h-12 rounded-control bg-surface-2 text-[16px] font-medium">
          Borrar
        </button>
        <button
          type="button"
          disabled={!hasInk || !agreement || !signer || pending}
          onClick={submit}
          className="press min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Firmar y guardar"}
        </button>
      </div>
      {(!agreement || !hasInk) && (
        <p className="text-center text-[12px] text-muted">{!agreement ? "Elige conforme o no conforme y firma." : "Falta la firma."}</p>
      )}
    </div>
  );
}

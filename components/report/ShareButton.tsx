"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { renderReportImage } from "@/lib/report-image";
import type { ShareModel } from "@/lib/report-share";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * Compartir el informe como imagen (PNG, faltas en rojo) o como texto con emojis.
 * La imagen se genera al abrir la hoja: iOS solo deja compartir justo tras el toque, sin esperas.
 */
export function ShareButton({ text, model, fileName }: { text: string; model: ShareModel; fileName: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || file) return;
    let alive = true;
    renderReportImage(model)
      .then((blob) => {
        if (!alive) return;
        setFile(new File([blob], fileName, { type: "image/png" }));
        setUrl(URL.createObjectURL(blob));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, file, model, fileName]);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  async function shareImage() {
    if (!file || !url) return;
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setOpen(false);
      } catch (e) {
        if (!isAbort(e)) notify("No se pudo compartir la imagen", "error");
      }
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setOpen(false);
  }

  async function shareText() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setOpen(false);
        return;
      } catch (e) {
        if (isAbort(e)) return;
      }
    }
    await copy();
  }

  async function copy() {
    const ok = await copyText(text);
    notify(ok ? "Texto copiado" : "No se pudo copiar", ok ? "ok" : "error");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Compartir informe"
        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg [touch-action:manipulation]"
      >
        <Icon name="share" className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Compartir informe">
        <div className="space-y-3 pb-2">
          <div className="flex max-h-[32vh] justify-center overflow-hidden rounded-card bg-surface-2">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Vista previa del informe" className="h-auto max-h-[32vh] w-auto object-contain object-top" />
            ) : (
              <p className="py-10 text-[14px] text-muted">{failed ? "No se pudo generar la imagen" : "Generando imagen…"}</p>
            )}
          </div>
          <button
            type="button"
            onClick={shareImage}
            disabled={!file}
            className="press flex min-h-12 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-50"
          >
            Compartir imagen
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={shareText}
              className="press min-h-11 rounded-control bg-surface-2 text-[15px] font-medium"
            >
              Compartir texto
            </button>
            <button type="button" onClick={copy} className="press min-h-11 rounded-control bg-surface-2 text-[15px] font-medium">
              Copiar texto
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

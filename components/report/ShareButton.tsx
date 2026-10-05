"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { notify } from "@/components/ui/toast";
import { renderReportImage } from "@/lib/report-image";
import type { ShareModel } from "@/lib/report-share";
import { nudgeFixedLayout } from "@/lib/viewport-fix";

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
        await navigator.share({ files: [file] }).finally(nudgeFixedLayout);
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
        await navigator.share({ text }).finally(nudgeFixedLayout);
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
        className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-fg"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
        Compartir
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

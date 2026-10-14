"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { renderReportImage } from "@/lib/report-image";
import { renderReportPdf } from "@/lib/report-pdf";
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

/** Foto de una nota para enviar junto al informe. */
export interface SharePhoto {
  url: string;
  name: string;
}

/** Nota con fotos: en el PDF, sus fotos van en una página con la nota debajo. */
export interface SharePhotoNote {
  who: string;
  label: string;
  when: string;
  text: string;
  photos: SharePhoto[];
}

/**
 * Compartir el informe: con fotos en las notas, PDF (informe + cada nota con sus fotos y el texto debajo) o la imagen
 * con las fotos sueltas; sin fotos, imagen (PNG, faltas en rojo). También como texto con emojis.
 * Todo se prepara al abrir la hoja: iOS solo deja compartir justo tras el toque, sin esperas.
 */
export function ShareButton({
  text,
  model,
  pdfModel = model,
  fileName,
  photoNotes = [],
}: {
  text: string;
  model: ShareModel;
  /** 1.ª página del PDF (sin las notas con foto, que van después con su foto). */
  pdfModel?: ShareModel;
  fileName: string;
  photoNotes?: SharePhotoNote[];
}) {
  const photos = photoNotes.flatMap((n) => n.photos);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[] | null>(photos.length === 0 ? [] : null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
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

  // Fotos de las notas (se descargan una vez al abrir la hoja).
  useEffect(() => {
    if (!open || photoFiles) return;
    let alive = true;
    Promise.all(
      photos.map(async (p) => {
        const r = await fetch(p.url);
        if (!r.ok) return null;
        const blob = await r.blob();
        return new File([blob], p.name, { type: blob.type || "image/webp" });
      }),
    )
      .then((list) => alive && setPhotoFiles(list.filter((f): f is File => !!f)))
      .catch(() => alive && setPhotoFiles([]));
    return () => {
      alive = false;
    };
  }, [open, photoFiles, photos]);

  // PDF (solo si hay fotos): cuando ya están descargadas.
  const pdfName = fileName.replace(/\.png$/, ".pdf");
  useEffect(() => {
    if (!open || pdf || pdfFailed || !photoFiles || photoFiles.length === 0) return;
    let alive = true;
    const byName = new Map(photoFiles.map((f) => [f.name, f]));
    const notes = photoNotes
      .map((n) => ({ ...n, photos: n.photos.flatMap((p) => byName.get(p.name) ?? []) }))
      .filter((n) => n.photos.length > 0);
    renderReportPdf(pdfModel, notes, pdfName.replace(/\.pdf$/, ""))
      .then((blob) => alive && setPdf(new File([blob], pdfName, { type: "application/pdf" })))
      .catch(() => alive && setPdfFailed(true));
    return () => {
      alive = false;
    };
  }, [open, pdf, pdfFailed, photoFiles, photoNotes, pdfModel, pdfName]);

  async function sharePdf() {
    if (!pdf) return;
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [pdf] })) {
      try {
        await navigator.share({ files: [pdf] });
        setOpen(false);
      } catch (e) {
        if (!isAbort(e)) notify("No se pudo compartir el PDF", "error");
      }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(pdf);
    a.download = pdf.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    setOpen(false);
  }

  async function shareImage() {
    if (!file || !url) return;
    const all = [file, ...(photoFiles ?? [])];
    const files = typeof navigator.canShare === "function" && navigator.canShare({ files: all }) ? all : [file];
    if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
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
          {photos.length > 0 && (
            <button
              type="button"
              onClick={sharePdf}
              disabled={!pdf}
              className="press flex min-h-12 w-full flex-col items-center justify-center rounded-control bg-accent py-1.5 text-accent-fg disabled:opacity-50"
            >
              <span className="text-[16px] font-semibold">
                {pdf ? "Compartir PDF" : pdfFailed ? "No se pudo crear el PDF" : "Preparando PDF…"}
              </span>
              <span className="text-[12px] opacity-90">Informe y cada foto con su nota debajo</span>
            </button>
          )}
          <button
            type="button"
            onClick={shareImage}
            disabled={!file || photoFiles === null}
            className={
              photos.length > 0
                ? "press min-h-11 w-full rounded-control bg-surface-2 text-[15px] font-medium disabled:opacity-50"
                : "press flex min-h-12 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-50"
            }
          >
            {photos.length === 0
              ? "Compartir imagen"
              : photoFiles === null
                ? "Preparando fotos…"
                : `Imagen + ${photoFiles.length === 1 ? "1 foto suelta" : `${photoFiles.length} fotos sueltas`}`}
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

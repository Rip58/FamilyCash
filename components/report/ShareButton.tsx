"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PhotoViewer } from "@/components/reports/PhotoViewer";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { renderReportImage } from "@/lib/report-image";
import { pagesToPdf, renderReportPages } from "@/lib/report-pdf";
import type { ShareModel } from "@/lib/report-share";
import { ModuleChecklist, useModulesCount } from "./ModulesButton";

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
  incident?: boolean;
  photos: SharePhoto[];
}

/**
 * Compartir el informe: PDF en hojas DIN A4 (el informe y, si las notas tienen fotos, una hoja por foto con su nota
 * debajo), o la imagen (PNG, con las fotos sueltas si las hay). También como texto con emojis.
 * Todo se prepara al abrir la hoja: iOS solo deja compartir justo tras el toque, sin esperas.
 */
export function ShareButton({
  text,
  model,
  pdfModel = model,
  fileName,
  photoNotes = [],
  editHref,
  withModules,
}: {
  text: string;
  model: ShareModel;
  /** Hojas del informe en el PDF (sin las notas con foto, que van después con su foto). */
  pdfModel?: ShareModel;
  fileName: string;
  photoNotes?: SharePhotoNote[];
  /** Dónde corregir lo que falte (Hoy de esa noche). */
  editHref?: string;
  /** Enseña dentro de la hoja «Qué sale en el informe» (solo en el Informe, con `ReportModulesProvider`). */
  withModules?: boolean;
}) {
  const photos = photoNotes.flatMap((n) => n.photos);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[] | null>(photos.length === 0 ? [] : null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  /** Vista previa de las páginas del PDF (la 1.ª es el informe). */
  const [pageUrls, setPageUrls] = useState<{ url: string; width: number; height: number }[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const { shown, total } = useModulesCount();

  // Si cambia lo que sale en el informe (módulos), se vuelve a preparar todo (imagen, fotos y PDF).
  const [forModel, setForModel] = useState(model);
  if (model !== forModel) {
    setForModel(model);
    setFile(null);
    setUrl(null);
    setFailed(false);
    setPdf(null);
    setPdfFailed(false);
    setPageUrls([]);
    setPhotoFiles(photos.length === 0 ? [] : null);
  }

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

  // PDF en hojas A4 (siempre): cuando ya están descargadas las fotos, si las hay.
  const pdfName = fileName.replace(/\.png$/, ".pdf");
  useEffect(() => {
    if (!open || pdf || pdfFailed || !photoFiles) return;
    let alive = true;
    const byName = new Map(photoFiles.map((f) => [f.name, f]));
    const notes = photoNotes
      .map((n) => ({ ...n, photos: n.photos.flatMap((p) => byName.get(p.name) ?? []) }))
      .filter((n) => n.photos.length > 0);
    // Si había fotos pero no se han podido descargar, el informe lleva las notas enteras (no «van en las páginas siguientes»).
    renderReportPages(notes.length > 0 || photos.length === 0 ? pdfModel : model, notes)
      .then(async (pages) => {
        const blob = await pagesToPdf(pages, pdfName.replace(/\.pdf$/, ""));
        if (!alive) return;
        setPageUrls(pages.map((p) => ({ url: URL.createObjectURL(p.jpeg), width: p.width, height: p.height })));
        setPdf(new File([blob], pdfName, { type: "application/pdf" }));
      })
      .catch(() => alive && setPdfFailed(true));
    return () => {
      alive = false;
    };
  }, [open, pdf, pdfFailed, photoFiles, photoNotes, photos.length, model, pdfModel, pdfName]);

  useEffect(() => () => pageUrls.forEach((p) => URL.revokeObjectURL(p.url)), [pageUrls]);

  // Lo que se ve en la vista previa: las páginas del PDF si lo hay; si no, la imagen del informe.
  const preview = useMemo(
    () =>
      pageUrls.length > 0
        ? pageUrls.map((p, i) => ({ id: `p${i}`, url: p.url, width: p.width, height: p.height, size: 0 }))
        : url
          ? [{ id: "img", url, width: 1080, height: 1920, size: 0 }]
          : [],
    [pageUrls, url],
  );
  // Si el PDF falla, se enseña la imagen.
  const previewPending = pdf || pdfFailed ? (pdfFailed && !url && !failed) : true;

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
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Vista previa{preview.length > 1 ? ` · ${preview.length} páginas` : ""}
            </h3>
            {editHref && (
              <Link href={editHref} className="press min-h-11 content-center text-[15px] font-medium text-accent">
                Corregir en Hoy
              </Link>
            )}
          </div>
          {withModules && total > 0 && (
            <div>
              <button
                type="button"
                aria-expanded={modulesOpen}
                onClick={() => setModulesOpen((o) => !o)}
                className="press flex min-h-11 w-full items-center gap-2 rounded-control bg-surface-2 px-3 text-left [touch-action:manipulation]"
              >
                <Icon name="sliders" className="h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
                <span className="flex-1 text-[15px] font-medium">Elegir módulos</span>
                <span className={`text-[14px] tabular-nums ${shown < total ? "font-semibold text-accent" : "text-muted"}`}>
                  {shown} de {total}
                </span>
                <Icon name="chevron" className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${modulesOpen ? "-rotate-90" : "rotate-90"}`} strokeWidth={2.4} />
              </button>
              {modulesOpen && (
                <div className="mt-2">
                  <ModuleChecklist />
                </div>
              )}
            </div>
          )}
          {preview.length === 0 || previewPending ? (
            <p className="rounded-card bg-surface-2 py-16 text-center text-[14px] text-muted">
              {failed ? "No se pudo generar la imagen" : "Preparando la vista previa…"}
            </p>
          ) : (
            <div className="space-y-3">
              {preview.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setZoom(i)}
                  aria-label={`Ampliar página ${i + 1}`}
                  className="block w-full overflow-hidden rounded-card border border-line bg-surface-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={i === 0 ? "Informe" : `Página ${i + 1}`} className="h-auto w-full" />
                </button>
              ))}
              <p className="text-center text-[13px] text-muted">
                Toca una página para ampliarla. ¿Falta algo? Cámbialo en Hoy o añade una nota y vuelve a abrir Compartir.
              </p>
            </div>
          )}
          <div className="sticky bottom-[calc(-16px-env(safe-area-inset-bottom))] -mx-4 space-y-2 border-t border-line bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={sharePdf}
              disabled={!pdf}
              className="press flex min-h-12 w-full flex-col items-center justify-center rounded-control bg-accent py-1.5 text-accent-fg disabled:opacity-50"
            >
              <span className="text-[16px] font-semibold">
                {pdf ? "Compartir PDF" : pdfFailed ? "No se pudo crear el PDF" : "Preparando PDF…"}
              </span>
              <span className="text-[12px] opacity-90">
                {pageUrls.length > 0 ? `${pageUrls.length === 1 ? "1 hoja" : `${pageUrls.length} hojas`} DIN A4` : "Hojas DIN A4"}
                {photos.length > 0 ? " · cada foto con su nota debajo" : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={shareImage}
              disabled={!file || photoFiles === null}
              className="press min-h-11 w-full rounded-control bg-surface-2 text-[15px] font-medium disabled:opacity-50"
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
        </div>
      </BottomSheet>
      <PhotoViewer photos={preview} index={zoom} onClose={() => setZoom(null)} />
    </>
  );
}

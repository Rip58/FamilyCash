"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { createProtocol, deleteProtocol, updateProtocol } from "@/app/actions/protocols";
import { discardUploadedFiles } from "@/app/actions/reports";
import { cn } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import type { ProtocolStepView } from "@/lib/planogram-format";
import { indentLine, makeBullet, outdentLine, type EditResult } from "@/lib/protocol-edit";
import { ProtocolBody } from "./ProtocolBody";
import { type EditorStep, StepsEditor, newStepKey } from "./StepsEditor";

interface Props {
  id: string | null; // null = protocolo nuevo
  initial: { title: string; category: string; body: string; steps: ProtocolStepView[] };
  categories: string[];
}

const NEW_CATEGORY = "__nueva__";
const CHEVRON_DOWN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

const inputCls =
  "min-h-11 w-full rounded-control bg-surface px-4 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent";

export function ProtocolEditor({ id, initial, categories }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  // Categoría: desplegable con las que ya existen; "nueva" muestra un campo de texto.
  const [newCategory, setNewCategory] = useState(false);
  const [body, setBody] = useState(initial.body);
  const [steps, setSteps] = useState<EditorStep[]>(() =>
    initial.steps.map((st) => ({ key: newStepKey(), text: st.text, photo: st.photo, uploading: null, error: null })),
  );
  // Fotos subidas en esta edición y aún sin guardar: si no se guarda, se descartan.
  const fresh = useRef(new Set<string>());
  const discard = (paths: string[]) => {
    paths.forEach((p) => fresh.current.delete(p));
    if (paths.length) void discardUploadedFiles({ pathnames: paths });
  };
  const uploading = steps.some((st) => st.uploading !== null);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const pendingSel = useRef<[number, number] | null>(null);
  // Restaura la selección justo tras pintar el nuevo texto (sin carreras con el teclado).
  useLayoutEffect(() => {
    const sel = pendingSel.current;
    const el = areaRef.current;
    if (!sel || !el) return;
    pendingSel.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  }, [body]);

  function apply(fn: (t: string, s: number, e: number) => EditResult) {
    const el = areaRef.current;
    if (!el) return;
    const r = fn(body, el.selectionStart, el.selectionEnd);
    if (r.text === body) {
      el.focus();
      el.setSelectionRange(r.start, r.end);
      return;
    }
    pendingSel.current = [r.start, r.end];
    setBody(r.text);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const data = {
        title,
        category,
        body,
        steps: steps.filter((st) => st.text.trim() || st.photo).map((st) => ({ text: st.text, photo: st.photo })),
      };
      const res = id ? await updateProtocol(id, data) : await createProtocol(data);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      fresh.current.clear();
      router.push("/protocolos");
      router.refresh();
    });
  }

  function remove() {
    if (!id) return;
    startTransition(async () => {
      const res = await deleteProtocol(id);
      if (!res.ok) {
        setError(res.error ?? "No se pudo borrar.");
        return;
      }
      router.push("/protocolos");
      router.refresh();
    });
  }

  const dirty =
    title !== initial.title ||
    category !== initial.category ||
    body !== initial.body ||
    steps.length !== initial.steps.length ||
    steps.some((st, i) => st.text !== initial.steps[i]?.text || st.photo !== initial.steps[i]?.photo);

  function close() {
    if (dirty && !window.confirm("¿Salir sin guardar los cambios?")) return;
    discard([...fresh.current]);
    router.push("/protocolos");
  }

  // Zona táctil de 44px con un botón visual más bajo.
  const toolBtn = "flex h-11 min-w-11 flex-1 items-center active:opacity-60";
  const toolFace = "flex h-9 w-full items-center justify-center rounded-full bg-surface px-3 text-[14px] font-medium text-accent";
  const keepFocus = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();

  return (
    <div className="pb-8">
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 flex items-center gap-2 bg-bg/95 px-4 pt-2 pb-1 backdrop-blur">
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar sin guardar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-fg active:opacity-70"
        >
          <Icon name="close" className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold">
          {id ? "Editar protocolo" : "Nuevo protocolo"}
        </h1>
        <button type="button" onClick={save} disabled={pending || uploading} className="flex h-11 shrink-0 items-center disabled:opacity-50">
          <span className="flex h-9 items-center rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-fg">
            {pending ? "Guardando…" : uploading ? "Subiendo…" : "Guardar"}
          </span>
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block px-1 text-[13px] font-medium text-muted">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Ej.: Apertura del turno"
            className={inputCls}
          />
        </label>
        <div>
          <label className="block">
            <span className="mb-1 block px-1 text-[13px] font-medium text-muted">Categoría</span>
            <select
              aria-label="Categoría"
              value={newCategory ? NEW_CATEGORY : category.trim()}
              onChange={(e) => {
                if (e.target.value === NEW_CATEGORY) {
                  setNewCategory(true);
                  setCategory("");
                } else {
                  setNewCategory(false);
                  setCategory(e.target.value);
                }
              }}
              className={cn(inputCls, "appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10")}
              style={{ backgroundImage: CHEVRON_DOWN }}
            >
              <option value="">General (sin categoría)</option>
              {[...new Set([...categories, initial.category.trim()].filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, "es"))
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              <option value={NEW_CATEGORY}>+ Nueva categoría…</option>
            </select>
          </label>
          {newCategory && (
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={60}
              autoFocus
              aria-label="Nombre de la nueva categoría"
              placeholder="Nombre de la nueva categoría"
              className={cn(inputCls, "mt-2")}
            />
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[13px] font-medium text-muted">Texto</span>
            <button
              type="button"
              aria-pressed={preview}
              onClick={() => setPreview((p) => !p)}
              className="min-h-11 px-1 text-[15px] font-medium text-accent"
            >
              {preview ? "Editar texto" : "Vista previa"}
            </button>
          </div>

          {!preview && (
            <div className="mb-1 flex gap-2" role="toolbar" aria-label="Ayudas de formato">
              <button
                type="button"
                className={toolBtn}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => apply(makeBullet)}
              >
                <span className={toolFace}>• Viñeta</span>
              </button>
              <button
                type="button"
                className={toolBtn}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => apply(indentLine)}
              >
                <span className={toolFace}>↳ Sub-viñeta</span>
              </button>
              <button
                type="button"
                aria-label="Quitar sangría"
                className={cn(toolBtn, "flex-none")}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => apply(outdentLine)}
              >
                <span className={toolFace}>↤</span>
              </button>
            </div>
          )}

          {preview ? (
            <div className="min-h-[240px] rounded-control bg-surface p-4">
              <ProtocolBody body={body} />
            </div>
          ) : (
            <textarea
              ref={areaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck
              rows={8}
              aria-label="Contenido del protocolo"
              placeholder={"- Primer paso\n  - Detalle del paso\n- **Importante**: usa negrita\n- Enlace: [texto](https://…)"}
              className="min-h-[200px] w-full resize-y rounded-control bg-surface p-4 font-mono text-[15px] leading-relaxed outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
            />
          )}
          <p className="mt-1 px-1 text-[13px] text-muted">
            Una línea por viñeta; dos espacios de sangría = sub-viñeta. Admite **negrita** y [texto](https://…).
          </p>
        </div>
      </div>

      <StepsEditor
        steps={steps}
        setSteps={setSteps}
        onUploaded={(p) => fresh.current.add(p)}
        onRemovedPhoto={(p) => {
          // Las ya guardadas se borran al guardar; las nuevas, ya.
          if (fresh.current.has(p)) discard([p]);
        }}
      />

      {error && (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {id && (
        <div className="mt-8">
          {confirmDelete ? (
            <div className="rounded-card bg-surface p-4">
              <p className="text-[16px] font-medium">¿Borrar este protocolo?</p>
              <p className="mt-1 text-[14px] text-muted">Esta acción no se puede deshacer.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-11 flex-1 rounded-control bg-surface-2 text-[16px] font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="min-h-11 flex-1 rounded-control bg-danger text-[16px] font-semibold text-white disabled:opacity-50"
                >
                  Borrar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-11 w-full rounded-control bg-surface text-[16px] font-medium text-danger"
            >
              Borrar protocolo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

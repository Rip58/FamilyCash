"use client";

import Link from "next/link";
import { useId, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/components/ui/cn";
import { notify } from "@/components/ui/toast";
import { COLOR_PALETTE, reorderIds } from "@/lib/settings-logic";

// ------------------------------------------------------------------ Feedback

export { Toaster, notify } from "@/components/ui/toast";

type Result = { ok: true } | { ok: false; error: string };

/** Ejecuta una acción de servidor mostrando "Guardado" o el error. */
export function useRun() {
  const [pending, start] = useTransition();
  function run<R extends Result>(fn: () => Promise<R>, opts?: { msg?: string; onDone?: (r: R & { ok: true }) => void }) {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          notify(opts?.msg ?? "Guardado");
          opts?.onDone?.(r as R & { ok: true });
        } else notify(r.error, "error");
      } catch {
        notify("No se pudo guardar. Reintenta.", "error");
      }
    });
  }
  return { pending, run };
}

/** Estado local que se resincroniza cuando cambian las props (tras revalidar). */
export function useSynced<T>(prop: T): [T, (v: T) => void] {
  const [state, setState] = useState(prop);
  const [prev, setPrev] = useState(prop);
  if (prop !== prev) {
    setPrev(prop);
    setState(prop);
  }
  return [state, setState];
}

// -------------------------------------------------------------------- Layout

export function BackHeader({
  title,
  action,
  href = "/ajustes",
  backLabel = "Volver a Ajustes",
}: {
  title: string;
  action?: ReactNode;
  href?: string;
  backLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 -mt-[env(safe-area-inset-top)] mb-2 flex min-h-14 items-center gap-2 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      <Link
        href={href}
        aria-label={backLabel}
        className="flex min-h-11 min-w-11 items-center justify-center text-accent"
      >
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 2 2 10l8 8" />
        </svg>
      </Link>
      <h1 className="flex-1 truncate text-[22px] font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}

export function PrimaryButton({ className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-11 rounded-control bg-accent px-4 text-[16px] font-semibold text-accent-fg disabled:opacity-40",
        className,
      )}
      {...rest}
    />
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-full px-3 text-[16px] font-semibold text-accent"
    >
      + {label}
    </button>
  );
}

// ---------------------------------------------------------------- Formulario

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="text-[13px] text-muted">{label}</div>
      {children}
      {hint && <div className="text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-control bg-surface-2 px-3 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Texto que confirma al perder el foco (o con Enter). */
export function TextInput({
  value,
  onCommit,
  label,
  placeholder,
  multiline,
  maxLength,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const [text, setText] = useSynced(value);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return multiline ? (
    <textarea
      aria-label={label}
      value={text}
      rows={3}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      className={cn(inputClass, "py-2")}
    />
  ) : (
    <input
      aria-label={label}
      value={text}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={inputClass}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1">
      <span id={id} className="text-[16px]">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-150 after:absolute after:-inset-x-1 after:-inset-y-[7px] after:content-[''] disabled:opacity-40",
          checked ? "bg-success" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all duration-150",
            checked ? "left-[22px]" : "left-[2px]",
          )}
        />
      </button>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const btn = "min-h-11 min-w-11 rounded-control bg-surface-2 text-[22px] font-medium disabled:opacity-30";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label="Menos" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="min-w-10 text-center text-[19px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="Más" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full"
        >
          <span
            className={cn(
              "block h-8 w-8 rounded-full",
              value.toLowerCase() === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
            )}
            style={{ backgroundColor: c }}
          />
        </button>
      ))}
    </div>
  );
}

/** Botón destructivo con confirmación en línea (sin diálogos nativos). */
export function ConfirmButton({
  label,
  confirmLabel = "Sí, borrar",
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className="min-h-11 w-full rounded-control bg-surface-2 text-[16px] font-medium text-danger disabled:opacity-40"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="min-h-11 flex-1 rounded-control bg-surface-2 text-[16px] font-medium"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className="min-h-11 flex-1 rounded-control bg-danger text-[16px] font-semibold text-white"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

// ------------------------------------------------------------- Arrastrar

export function GripIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
      {[4, 9, 14].flatMap((y) => [6, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}

/** Asa de arrastre (≥44px). touch-action: manipulation: un swipe rápido hace scroll; mantener 200 ms arrastra. */
export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Arrastrar para reordenar"
      {...props}
      className="flex min-h-11 min-w-11 shrink-0 cursor-grab touch-manipulation select-none items-center justify-center text-muted active:cursor-grabbing"
    >
      <GripIcon />
    </button>
  );
}

function SortableRow<T extends { id: string }>({
  item,
  render,
}: {
  item: T;
  render: (item: T, handle: ReactNode, dragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const handle = <DragHandle {...attributes} {...listeners} />;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={cn("relative", isDragging && "opacity-90 shadow-lg")}
    >
      {render(item, handle, isDragging)}
    </div>
  );
}

/**
 * Lista reordenable con dnd-kit. `onReorder` recibe los ids en el orden nuevo.
 * La lista se actualiza al instante (optimista) y se resincroniza con `items`.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  render: (item: T, handle: ReactNode, dragging: boolean) => ReactNode;
}) {
  const [local, setLocal] = useSynced(items);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Táctil: hay que mantener ~200 ms antes de arrastrar, así un gesto rápido sigue haciendo scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = reorderIds(local.map((i) => i.id), String(active.id), String(over.id));
    const byId = new Map(local.map((i) => [i.id, i]));
    setLocal(ids.map((id) => byId.get(id)!));
    onReorder(ids);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={local.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {local.map((item) => (
          <SortableRow key={item.id} item={item} render={render} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

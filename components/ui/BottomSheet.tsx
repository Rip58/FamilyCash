"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { sheetDragOffset, shouldDismissSheet } from "@/lib/gesture";
import { createPortal } from "react-dom";
import { cn } from "./cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Permite cerrar arrastrando la barra superior hacia abajo (por defecto sí). */
  draggable?: boolean;
  className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Hoja inferior accesible: role=dialog, cierra con backdrop / Escape /
 * arrastre, bloquea el scroll del fondo y devuelve el foco al cerrar.
 */
export function BottomSheet({ open, onClose, title, children, draggable = true, className }: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const dragStartTime = useRef(0);
  const [dragging, setDragging] = useState(false);

  // Montar al abrir (ajuste de estado durante el render).
  if (open && !mounted) setMounted(true);
  const visible = open && entered;

  // Transición de entrada / salida y desmontaje diferido.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    const t = setTimeout(() => {
      setEntered(false);
      setMounted(false);
    }, 300); // = duración de la salida (duration-300)
    return () => clearTimeout(t);
  }, [open]);

  // Foco, scroll lock y Escape.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    dragStartTime.current = performance.now();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(sheetDragOffset(e.clientY - dragStart.current));
  }, []);
  const onPointerUp = useCallback(() => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    const elapsed = performance.now() - dragStartTime.current;
    setDragY((y) => {
      // Se cierra si se baja lo bastante o con un gesto rápido hacia abajo; si no, vuelve arriba.
      if (shouldDismissSheet(y, elapsed)) onClose();
      return 0;
    });
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        data-testid="sheet-backdrop"
        onClick={onClose}
        className={cn("absolute inset-0 transition-opacity duration-300 ease-drawer", visible ? "opacity-100" : "opacity-0")}
        style={{ backgroundColor: "var(--backdrop)" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[20px] bg-surface outline-none",
          !dragging && "transition-transform duration-300 ease-drawer",
          className,
        )}
        style={{ transform: visible ? `translateY(${dragY}px)` : "translateY(100%)" }}
      >
        <div
          className={cn("flex h-7 shrink-0 items-center justify-center", draggable && "touch-none cursor-grab")}
          onPointerDown={draggable ? onPointerDown : undefined}
          onPointerMove={draggable ? onPointerMove : undefined}
          onPointerUp={draggable ? onPointerUp : undefined}
          onPointerCancel={draggable ? onPointerUp : undefined}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-2">
          <h2 id={titleId} className="text-[17px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-full text-[15px] font-medium text-accent"
          >
            Cerrar
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

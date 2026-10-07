"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { lockAppScroll } from "@/lib/viewport-fix";
import { createPortal } from "react-dom";
import { cn } from "./cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Hoja a pantalla completa (sube desde abajo): título y «Cerrar» arriba, sin gestos de arrastre (se colgaban en
 * iOS). role=dialog, cierra con Escape, bloquea el scroll del fondo y devuelve el foco al cerrar. Si se navega a
 * otra página con la hoja abierta (p. ej. «Ver ficha»), se cierra sola.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Montar al abrir (ajuste de estado durante el render) y recordar en qué página se abrió.
  if (open && !mounted) {
    setMounted(true);
    setOpenedAt(pathname);
  }
  const elsewhere = pathname !== openedAt;
  const visible = open && entered && !elsewhere;

  // Al cambiar de página con la hoja abierta: cerrarla (y no pintarla en la página nueva).
  useEffect(() => {
    if (open && elsewhere) onClose();
  }, [open, elsewhere, onClose]);

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
    if (!open || elsewhere) return;
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockAppScroll();
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
      unlock();
      previous?.focus?.();
    };
  }, [open, elsewhere, onClose]);

  if (!mounted || elsewhere || typeof document === "undefined") return null;

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
          "absolute inset-0 mx-auto flex h-[100dvh] w-full max-w-xl flex-col bg-surface pt-[env(safe-area-inset-top)] outline-none transition-transform duration-300 ease-drawer",
          className,
        )}
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <h2 id={titleId} className="min-w-0 truncate text-[17px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="press min-h-11 shrink-0 rounded-full bg-surface-2 px-4 text-[15px] font-semibold text-accent"
          >
            Cerrar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

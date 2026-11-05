"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import { REPORT_MODULES, type ReportModule, hiddenModulesParam } from "@/lib/report-modules";

/**
 * «Qué sale en el informe»: una fila con el resumen («9 de 9 módulos») que abre una hoja con una casilla por módulo.
 * Lo que se desmarca desaparece del Informe y de lo que se comparte (imagen, PDF y texto) esa noche. Se guarda en la
 * dirección (`?sin=pasillos,notas`), así que sirve para esa noche y se mantiene al cambiar de día.
 */
export function ModulesButton({ hidden }: { hidden: ReportModule[] }) {
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState<ReportModule[]>(hidden);
  const [, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const shown = REPORT_MODULES.length - off.length;

  const apply = (next: ReportModule[]) => {
    setOff(next);
    const q = new URLSearchParams(params.toString());
    const value = hiddenModulesParam(next);
    if (value) q.set("sin", value);
    else q.delete("sin");
    const s = q.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  const toggle = (k: ReportModule) => apply(off.includes(k) ? off.filter((x) => x !== k) : [...off, k]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Módulos del informe: ${shown} de ${REPORT_MODULES.length}`}
        className="press flex min-h-11 w-full items-center gap-2 rounded-control bg-surface px-3 text-left [touch-action:manipulation]"
      >
        <Icon name="sliders" className="h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
        <span className="flex-1 text-[15px] font-medium">Módulos del informe</span>
        <span className={cn("text-[14px] tabular-nums", off.length > 0 ? "font-semibold text-accent" : "text-muted")}>
          {shown} de {REPORT_MODULES.length}
        </span>
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" strokeWidth={2.4} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Qué sale en el informe">
        <div className="flex flex-col gap-2 pb-2">
          <p className="px-1 text-[13px] text-muted">
            Marca lo que quieres en el informe de esta noche. Lo que quites no sale ni en pantalla ni al compartirlo (imagen, PDF
            y texto).
          </p>
          <ul className="overflow-hidden rounded-card bg-surface-2">
            {REPORT_MODULES.map((m) => {
              const on = !off.includes(m.key);
              return (
                <li key={m.key} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(m.key)}
                    className="press flex min-h-14 w-full items-center gap-3 px-3.5 text-left [touch-action:manipulation]"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2",
                        on ? "border-accent bg-accent text-accent-fg" : "border-line",
                      )}
                    >
                      {on && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[16px] leading-tight", !on && "text-muted")}>{m.label}</span>
                      <span className="block text-[12px] leading-tight text-muted">{m.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => apply([])} disabled={off.length === 0} className="press min-h-11 rounded-control bg-surface-2 text-[15px] font-medium disabled:opacity-40">
              Marcar todo
            </button>
            <button type="button" onClick={() => setOpen(false)} className="press min-h-11 rounded-control bg-accent text-[15px] font-semibold text-accent-fg">
              Listo
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

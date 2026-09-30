import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  /** Contenido a la derecha de la cabecera (p. ej. un contador). */
  action?: ReactNode;
  /** Sin padding interno (para listas a sangre). */
  flush?: boolean;
  /** Borde discontinuo de alerta. */
  tone?: "default" | "danger" | "warning";
}

export function Card({ title, action, flush, tone = "default", className, children, ...rest }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-card bg-surface overflow-hidden",
        tone === "danger" && "border border-dashed border-danger",
        tone === "warning" && "border border-warning",
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <header className="flex min-h-11 items-center justify-between gap-3 px-4 pt-3">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn(!flush && "p-4", flush && !!title && "pt-1")}>{children}</div>
    </section>
  );
}

/**
 * Iconos de línea (24×24, trazo 1.8) en el mismo estilo que la barra de pestañas.
 * Uso: <Icon name="users" className="h-5 w-5" />
 */
const PATHS = {
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M5.5 5h13L21 13v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-6z" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <path d="M8.2 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.8" />
    </>
  ),
  swatch: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="10" r="1.3" />
      <circle cx="12" cy="7.5" r="1.3" />
      <circle cx="16" cy="10" r="1.3" />
      <path d="M12 21a2.5 2.5 0 0 1 0-5h2.5a2.5 2.5 0 0 0 2.5-2.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  moon: <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7z" />,
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M16 13.5h1.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10 3.5 11.6 8 16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5 8.4 8z" />
      <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-4.5-4.5L7 20.5" />
    </>
  ),
  /** Cierre de turno: reloj con luna. */
  clockMoon: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
      <path d="M12 7.5V12l3 2" />
      <path d="M20.5 3.2a3 3 0 1 0 1.2 4.6 2.4 2.4 0 0 1-1.2-4.6z" />
    </>
  ),
  /** Vista agrupada por departamentos. */
  group: (
    <>
      <rect x="3.5" y="3.5" width="17" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="17" height="7" rx="2" />
    </>
  ),
  /** Lista plana en el orden del Excel. */
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5" />,
  /** Reordenar. */
  sort: <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  /** Más opciones (tres puntos). */
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  /** Compartir. */
  share: <path d="M12 3.5v11M8 7.5l4-4 4 4M5.5 12v6.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V12" />,
  /** Buscar. */
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  /** Nota. */
  note: (
    <>
      <path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9.5L15.5 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5z" />
      <path d="M20.5 15.5h-3.5a1.5 1.5 0 0 0-1.5 1.5v3.5M7.5 9h9M7.5 12.5h5" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-5 w-5"}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Fondo pastel a partir de un color de estado/departamento (vale en claro y oscuro). */
export function tint(color: string | null | undefined, pct = 16): string {
  return `color-mix(in srgb, ${color ?? "#64748b"} ${pct}%, transparent)`;
}

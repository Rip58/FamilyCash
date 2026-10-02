"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { cn } from "./cn";

const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const TABS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/hoy",
    label: "Hoy",
    icon: (
      <svg {...iconProps}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    ),
  },
  {
    href: "/semana",
    label: "Semana",
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/informe",
    label: "Informe",
    icon: (
      <svg {...iconProps}>
        <path d="M7 3.5h7.5L19 8v12.5H7z" />
        <path d="M14 3.5V8h5M10 12.5h6M10 16h6" />
      </svg>
    ),
  },
  {
    href: "/nomina",
    label: "Nómina",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M15 9.5a3 3 0 1 0 0 5M9.5 11h4M9.5 13h4" />
      </svg>
    ),
  },
  {
    href: "/protocolos",
    label: "Protocolos",
    icon: (
      <svg {...iconProps}>
        <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
        <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 8h6M9 12h6" />
      </svg>
    ),
  },
  {
    href: "/ajustes",
    label: "Ajustes",
    icon: (
      <svg {...iconProps}>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </svg>
    ),
  },
];

/** Al volver a la app tras un rato fuera, refresca los datos (puede haber cambios desde otro móvil). */
const REFRESH_AFTER_MS = 2 * 60_000;

function useRefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > REFRESH_AFTER_MS) router.refresh();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);
}

/** Icono de la pestaña; mientras carga la página pedida, late suavemente. */
function TabIcon({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={cn("transition-opacity", pending && "animate-pulse opacity-50")}>{children}</span>;
}

export function TabBar() {
  const pathname = usePathname();
  useRefreshOnReturn();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line backdrop-blur-xl"
      style={{ backgroundColor: "var(--tabbar-bg)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                // Precarga la página COMPLETA (con datos) en segundo plano: al tocar la pestaña sale al instante.
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <TabIcon>{t.icon}</TabIcon>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { cn } from "@/components/ui/cn";

export type ProtocolTab = "protocolos" | "lineales" | "reuniones";

const TABS = [
  { key: "protocolos", href: "/protocolos", label: "Protocolos" },
  { key: "lineales", href: "/protocolos/lineales", label: "Lineales" },
  { key: "reuniones", href: "/protocolos/reuniones", label: "Reuniones" },
] as const;

/**
 * Cabecera de Protocolos: título, «+ Nuevo» (desplegable: protocolo, lineal o tema de reunión) y las pestañas.
 * `onNew` = crear en la pestaña actual sin cambiar de página; en otra pestaña se va con `?nuevo=1`.
 */
export function ProtocolsHeader({ active, onNew }: { active: ProtocolTab; onNew?: () => void }) {
  const router = useRouter();
  const go = (tab: ProtocolTab, href: string) => (tab === active && onNew ? onNew() : router.push(href));
  return (
    <>
      <div className="flex items-center justify-between gap-3 pt-3">
        <h1 className="text-[24px] font-bold tracking-tight">Protocolos</h1>
        <ActionMenu
          pill="Nuevo"
          label="Crear nuevo"
          items={[
            { icon: "list", label: "Protocolo", onSelect: () => router.push("/protocolos/nuevo") },
            { icon: "images", label: "Lineal", onSelect: () => go("lineales", "/protocolos/lineales?nuevo=1") },
            { icon: "users", label: "Tema para reunión", onSelect: () => go("reuniones", "/protocolos/reuniones?nuevo=1") },
          ]}
        />
      </div>
      <ProtocolTabs active={active} />
    </>
  );
}

/** Pestañas de Protocolos: los protocolos (texto y pasos con foto), los lineales y las reuniones. */
export function ProtocolTabs({ active }: { active: ProtocolTab }) {
  return (
    <nav aria-label="Secciones de protocolos" className="mt-2 flex gap-1 rounded-control bg-surface-2 p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "flex min-h-9 flex-1 items-center justify-center rounded-[8px] px-3 text-[13px] font-medium transition-colors",
            active === t.key ? "bg-accent text-white shadow-sm" : "text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Quita `?nuevo=1` de la dirección tras abrir la hoja (para que al volver atrás o recargar no se abra otra vez). */
export function useCleanNewParam(active: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (active) router.replace(pathname, { scroll: false });
  }, [active, pathname, router]);
}

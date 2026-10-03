import Link from "next/link";
import { cn } from "@/components/ui/cn";

/** Pestañas de Protocolos: los protocolos (texto y pasos con foto) y los lineales. */
export function ProtocolTabs({ active }: { active: "protocolos" | "lineales" }) {
  const tabs = [
    { key: "protocolos", href: "/protocolos", label: "Protocolos" },
    { key: "lineales", href: "/protocolos/lineales", label: "Lineales" },
  ] as const;
  return (
    <nav aria-label="Secciones de protocolos" className="mt-2 flex gap-1 rounded-control bg-surface-2 p-1">
      {tabs.map((t) => (
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

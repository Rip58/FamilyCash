"use client";

import { usePathname, useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/Segmented";
import type { FileTab } from "@/lib/file-tabs";

const OPTIONS: { value: FileTab; label: string }[] = [
  { value: "datos", label: "Datos" },
  { value: "historial", label: "Historial" },
];

/** Pestañas de la ficha: Datos (por defecto, a la izquierda) e Historial; la elegida vive en ?tab= (se puede enlazar). */
export function FileTabs({ tab }: { tab: FileTab }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Segmented
      aria-label="Secciones de la ficha"
      value={tab}
      options={OPTIONS}
      onChange={(v) => router.replace(v === "datos" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}
    />
  );
}

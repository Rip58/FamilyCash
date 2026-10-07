"use client";

import { usePathname, useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/Segmented";
import type { FileTab } from "@/lib/file-tabs";

const OPTIONS: { value: FileTab; label: string }[] = [
  { value: "historial", label: "Historial" },
  { value: "datos", label: "Datos" },
];

/** Pestañas de la ficha: la elegida vive en ?tab= (se puede enlazar). */
export function FileTabs({ tab }: { tab: FileTab }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Segmented
      aria-label="Secciones de la ficha"
      value={tab}
      options={OPTIONS}
      onChange={(v) => router.replace(v === "historial" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}
    />
  );
}

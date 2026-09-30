"use client";

import { usePathname, useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/Segmented";
import type { FileTab } from "@/lib/employee-file";

const OPTIONS: { value: FileTab; label: string }[] = [
  { value: "datos", label: "Datos" },
  { value: "historial", label: "Historial" },
  { value: "peticiones", label: "Peticiones" },
];

/** Pestañas de la ficha: la elegida vive en ?tab= (se puede enlazar). */
export function FileTabs({ tab, pending }: { tab: FileTab; pending: number }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Segmented
      aria-label="Secciones de la ficha"
      value={tab}
      options={OPTIONS.map((o) => (o.value === "peticiones" && pending > 0 ? { ...o, label: `Peticiones · ${pending}` } : o))}
      onChange={(v) => router.replace(v === "datos" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}
    />
  );
}

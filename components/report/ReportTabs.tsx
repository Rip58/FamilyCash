"use client";

import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui";

type View = "dia" | "semana";

/** Pestañas Día / Semana. La semana vive en `?v=semana`. */
export function ReportTabs({ date, view }: { date: string; view: View }) {
  const router = useRouter();
  return (
    <Segmented<View>
      aria-label="Vista del informe"
      value={view}
      options={[
        { value: "dia", label: "Día" },
        { value: "semana", label: "Semana" },
      ]}
      onChange={(v) => router.push(v === "semana" ? `/informe/${date}?v=semana` : `/informe/${date}`)}
    />
  );
}

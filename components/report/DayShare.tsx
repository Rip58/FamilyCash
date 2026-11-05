"use client";

import { useMemo } from "react";
import { dayShareProps } from "@/lib/report-share-props";
import type { DayReport } from "@/lib/report";
import { ShareButton } from "./ShareButton";
import { useReportModules } from "./ReportModulesContext";

/** Botón de compartir del Informe: se rehace solo al cambiar los módulos que salen (también desde su propia hoja). */
export function DayShare({ report, date, editHref }: { report: DayReport; date: string; editHref: string }) {
  const hidden = useReportModules()?.hidden;
  const props = useMemo(() => dayShareProps(report, date, hidden ?? []), [report, date, hidden]);
  return <ShareButton {...props} editHref={editHref} withModules />;
}

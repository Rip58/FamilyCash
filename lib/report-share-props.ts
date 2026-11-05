// Datos del botón «Compartir informe» de una noche (`ShareButton`): los usan el Informe y la página del compañero
// (/turno), para que los dos compartan exactamente lo mismo.
import { type DateStr, formatDayLong } from "./dates";
import { noteLabel, noteWho } from "./notes";
import type { DayReport } from "./report";
import type { ReportModule } from "./report-modules";
import { buildShareModel, pdfShareModel, shareModelToText } from "./report-share";

/** Lo de las notas que no sale esta vez (módulos quitados): ni en el informe ni sus fotos. */
function withoutHiddenNotes(report: DayReport, hidden: ReportModule[]): DayReport {
  const out = report.notes.filter((n) => !hidden.includes(n.type === "NOTIFICATION" ? "notifications" : "notes"));
  return out.length === report.notes.length ? report : { ...report, notes: out };
}

/** `hidden` = módulos que esta vez no salen (se eligen en la página de Informe); por defecto salen todos. */
export function dayShareProps(full: DayReport, date: DateStr, hidden: ReportModule[] = []) {
  const report = withoutHiddenNotes(full, hidden);
  return {
    text: shareModelToText(buildShareModel(report, hidden)),
    model: buildShareModel(report, hidden),
    pdfModel: pdfShareModel(report, hidden),
    fileName: `informe-noche-${date}.png`,
    photoNotes: report.notes
      .filter((n) => n.photos.length > 0)
      .map((n, k) => ({
        who: noteWho(n),
        label: noteLabel(n),
        when: `${formatDayLong(n.date)}${n.time ? ` · ${n.time}` : ""}`,
        text: n.text,
        incident: n.type === "INCIDENT",
        photos: n.photos.map((ph, i) => ({
          url: ph.url,
          name: `${date}-${(n.employeeName ?? "nota").replace(/\s+/g, "-")}-${k + 1}-${i + 1}.${ph.url.split(".").pop() ?? "webp"}`,
        })),
      })),
  };
}

// Datos del botón «Compartir informe» de una noche (`ShareButton`): los usan el Informe y la página del compañero
// (/turno), para que los dos compartan exactamente lo mismo.
import { type DateStr, formatDayLong } from "./dates";
import { noteLabel, noteWho } from "./notes";
import { type DayReport, reportToText } from "./report";
import { buildShareModel, pdfShareModel } from "./report-share";

export function dayShareProps(report: DayReport, date: DateStr) {
  return {
    text: reportToText(report),
    model: buildShareModel(report),
    pdfModel: pdfShareModel(report),
    fileName: `informe-noche-${date}.png`,
    photoNotes: report.notes
      .filter((n) => n.photos.length > 0)
      .map((n, k) => ({
        who: noteWho(n),
        label: noteLabel(n),
        when: `${formatDayLong(n.date)}${n.time ? ` · ${n.time}` : ""}`,
        text: n.text,
        photos: n.photos.map((ph, i) => ({
          url: ph.url,
          name: `${date}-${(n.employeeName ?? "nota").replace(/\s+/g, "-")}-${k + 1}-${i + 1}.${ph.url.split(".").pop() ?? "webp"}`,
        })),
      })),
  };
}

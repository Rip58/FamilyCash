// Exportación del informe de la noche (texto con emojis e imagen). Sin zod: se usa también en el cliente.
import { formatOvertime } from "./overtime";
import type { DayReport, NightNoteView } from "./report";
import { photoCountLabel } from "./report-format";

export interface ShareMember {
  name: string;
  /** Detalles cortos: "⏰ 22:15", "de Botellería", "+1 h"… */
  tags: string[];
}

export interface ShareDepartment {
  name: string;
  color: string;
  members: ShareMember[];
}

export interface ShareMissing {
  name: string;
  label: string;
  reason: string | null;
  color: string;
}

export interface ShareModel {
  title: string;
  shift: string;
  counts: { working: number; off: number; missing: number };
  working: ShareDepartment[];
  off: string[];
  missing: ShareMissing[];
  emptyDepartments: string[];
  times: string[];
  overtime: { total: string; items: string[] } | null;
  notes: string[];
  reports: string[];
}

/** Color de departamento → cuadrado de color (emoji) más parecido. */
export function colorEmoji(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "⬜";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.12) return max > 0.75 ? "⬜" : "⬛";
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (max < 0.45 && h > 15 && h < 50) return "🟫";
  if (h < 15 || h >= 335) return "🟥";
  if (h < 45) return "🟧";
  if (h < 70) return "🟨";
  if (h < 165) return "🟩";
  if (h < 255) return "🟦";
  return "🟪";
}

const taskMark = (n: NightNoteView) => (n.isTask ? (n.done ? "✅ " : "☐ ") : "");

export function buildShareModel(report: DayReport): ShareModel {
  const late = new Map(report.lateArrivals.map((l) => [l.name, l]));
  const member = (m: DayReport["unassigned"][number]): ShareMember => {
    const tags: string[] = [];
    if (m.movedFrom) tags.push(`de ${m.movedFrom}`);
    const l = late.get(m.name);
    if (l) tags.push(`⏰ ${l.arrivedAt}`);
    if (m.extraMinutes) tags.push(formatOvertime(m.extraMinutes, true));
    return { name: m.name, tags };
  };
  const working: ShareDepartment[] = report.departments.map((d) => ({
    name: d.name,
    color: d.color,
    members: d.members.map(member),
  }));
  if (report.unassigned.length > 0) {
    working.push({ name: "Sin departamento", color: "#8e8e93", members: report.unassigned.map(member) });
  }

  const off = report.absences.filter((g) => g.dayOff).flatMap((g) => g.members.map((m) => m.name));
  const missing: ShareMissing[] = report.absences
    .filter((g) => !g.dayOff)
    .flatMap((g) => g.members.map((m) => ({ name: m.name, label: g.label, reason: m.reason, color: g.color })));

  const times = [
    ...report.lateArrivals.map(
      (l) => `${l.name} llega tarde a las ${l.arrivedAt} (+${formatOvertime(l.minutes)})${l.reason ? ` — ${l.reason}` : ""}`,
    ),
    ...report.leaveDeviations.map((d) => {
      const what = d.kind === "stayed" ? `se queda ${formatOvertime(d.minutes)} más` : `se va ${formatOvertime(d.minutes)} antes`;
      return `${d.name} ${what} (sale a las ${d.leftAt})${d.reason ? ` — ${d.reason}` : ""}`;
    }),
  ];

  const notes = [
    ...(report.note ? [report.note] : []),
    ...report.nightNotes.filter((n) => !n.name && !n.department).map((n) => `${taskMark(n)}${n.text}`),
    ...report.employeeNotes.map((n) => `${n.name}: ${n.note}`),
    ...report.nightNotes
      .filter((n) => n.name || n.department)
      .map((n) => `${[n.name, n.department].filter(Boolean).join(" · ")}: ${taskMark(n)}${n.text}`),
  ];

  const reports = report.reports.map((r) => {
    const who = r.employeeName ? `${r.employeeName}: ` : "";
    const where = r.sectionName ? ` [${r.sectionName}]` : "";
    const photos = r.photos.length > 0 ? ` (${photoCountLabel(r.photos.length)})` : "";
    return `${who}${r.text.replace(/\s*\n\s*/g, " ")}${where}${photos}`;
  });

  return {
    title: report.title,
    shift: `${report.shift.start}–${report.shift.end}`,
    counts: { working: report.presentCount, off: off.length, missing: missing.length },
    working,
    off,
    missing,
    emptyDepartments: report.emptyDepartments,
    times,
    overtime:
      report.overtime.items.length > 0
        ? {
            total: formatOvertime(report.overtime.totalMinutes),
            items: report.overtime.items.map(
              (o) => `${o.name}: ${o.minutes > 0 ? formatOvertime(o.minutes, true) : "sin tiempo"}${o.note ? ` — ${o.note}` : ""}`,
            ),
          }
        : null,
    notes,
    reports,
  };
}

/** Texto para WhatsApp/iMessage: emojis, *negritas* y viñetas. Orden: trabajan → fiesta → faltan (🔴). */
export function shareModelToText(m: ShareModel): string {
  const L: string[] = [];
  L.push(`🌙 *Informe de noche*`);
  L.push(`📅 ${m.title} · 🕘 ${m.shift}`);
  L.push(
    [`✅ ${m.counts.working} trabajan`, m.counts.off > 0 && `🏖️ ${m.counts.off} fiesta`, m.counts.missing > 0 && `🔴 ${m.counts.missing} faltan`]
      .filter(Boolean)
      .join(" · "),
  );

  if (m.working.length > 0) {
    L.push("", `✅ *TRABAJAN (${m.counts.working})*`);
    for (const d of m.working) {
      L.push(`${colorEmoji(d.color)} *${d.name}* (${d.members.length})`);
      for (const p of d.members) L.push(`   • ${p.name}${p.tags.length > 0 ? ` · ${p.tags.join(" · ")}` : ""}`);
    }
  }

  if (m.off.length > 0) {
    L.push("", `🏖️ *FIESTA (${m.off.length})*`);
    L.push(`   ${m.off.join(", ")}`);
  }

  if (m.missing.length > 0 || m.emptyDepartments.length > 0) {
    L.push("", m.missing.length > 0 ? `🔴 *FALTAN (${m.missing.length})*` : "⚠️ *DEPARTAMENTOS VACÍOS*");
    for (const p of m.missing) L.push(`🔴 ${p.name} — ${p.label}${p.reason ? ` (${p.reason})` : ""}`);
    for (const d of m.emptyDepartments) L.push(`⚠️ Sin personal en *${d}*`);
  }

  if (m.times.length > 0) {
    L.push("", "⏰ *HORARIOS*");
    for (const t of m.times) L.push(`   • ${t}`);
  }

  if (m.overtime) {
    L.push("", `⏱️ *HORAS EXTRA* (total ${m.overtime.total})`);
    for (const t of m.overtime.items) L.push(`   • ${t}`);
  }

  if (m.notes.length > 0) {
    L.push("", "📝 *NOTAS DE LA NOCHE*");
    for (const t of m.notes) L.push(`   • ${t}`);
  }

  if (m.reports.length > 0) {
    L.push("", "📷 *AVISOS CON FOTO*");
    for (const t of m.reports) L.push(`   • ${t}`);
  }

  if (m.missing.length === 0 && m.emptyDepartments.length === 0 && m.times.length === 0) {
    L.push("", "👍 Sin incidencias");
  }

  return L.join("\n");
}

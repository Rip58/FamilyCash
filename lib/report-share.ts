// Exportación del informe de la noche (texto con emojis e imagen). Sin zod: se usa también en el cliente.
import { formatOvertime } from "./overtime";
import { noteLine } from "./notes";
import type { DayReport } from "./report";

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

/** Ausencias previstas en el planning (vacaciones, baja…): normales, no son faltas. */
export interface ShareAway {
  label: string;
  members: { name: string; reason: string | null }[];
}

export interface ShareModel {
  title: string;
  shift: string;
  counts: { working: number; off: number; away: number; missing: number };
  working: ShareDepartment[];
  off: string[];
  away: ShareAway[];
  missing: ShareMissing[];
  emptyDepartments: string[];
  times: string[];
  overtime: { total: string; items: string[] } | null;
  notes: string[];
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

  // Faltan = les tocaba trabajar y no han venido, o tienen «Falta» (ABSENT). Fiesta, vacaciones y bajas son normales.
  const off = report.absences
    .filter((g) => g.dayOff)
    .flatMap((g) => g.members.filter((m) => !m.noShow).map((m) => m.name));
  const isMissing = (g: DayReport["absences"][number], m: { noShow: boolean }) => g.absent || m.noShow;
  const away: ShareAway[] = report.absences
    .filter((g) => !g.dayOff)
    .map((g) => ({ label: g.label, members: g.members.filter((m) => !isMissing(g, m)).map(({ name, reason }) => ({ name, reason })) }))
    .filter((g) => g.members.length > 0);
  const missing: ShareMissing[] = report.absences.flatMap((g) =>
    g.members.filter((m) => isMissing(g, m)).map((m) => ({ name: m.name, label: g.label, reason: m.reason, color: g.color })),
  );

  const times = [
    ...report.lateArrivals.map(
      (l) => `${l.name} llega tarde a las ${l.arrivedAt} (+${formatOvertime(l.minutes)})${l.reason ? ` — ${l.reason}` : ""}`,
    ),
    ...report.leaveDeviations.map((d) => {
      const what = d.kind === "stayed" ? `se queda ${formatOvertime(d.minutes)} más` : `se va ${formatOvertime(d.minutes)} antes`;
      return `${d.name} ${what} (sale a las ${d.leftAt})${d.reason ? ` — ${d.reason}` : ""}`;
    }),
  ];

  const notes = report.notes.map((n) => noteLine(n));

  return {
    title: report.title,
    shift: `${report.shift.start}–${report.shift.end}`,
    counts: {
      working: report.presentCount,
      off: off.length,
      away: away.reduce((n, g) => n + g.members.length, 0),
      missing: missing.length,
    },
    working,
    off,
    away,
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
  };
}

/** Texto para WhatsApp/iMessage: emojis, títulos en mayúsculas y una línea por departamento (sin *asteriscos*: iMessage los muestra tal cual). Orden: trabajan → fiesta → vacaciones/bajas → faltan (🔴). */
export function shareModelToText(m: ShareModel): string {
  const L: string[] = [];
  L.push("🌙 INFORME DE NOCHE");
  L.push(`📅 ${m.title} · 🕘 ${m.shift}`);
  L.push(
    [
      `✅ ${m.counts.working} trabajan`,
      m.counts.off > 0 && `🏖️ ${m.counts.off} fiesta`,
      m.counts.away > 0 && `🌴 ${m.counts.away} vacaciones/baja`,
      m.counts.missing > 0 && `🔴 ${m.counts.missing} faltan`,
    ]
      .filter(Boolean)
      .join(" · "),
  );

  if (m.working.length > 0) {
    L.push("", `✅ TRABAJAN (${m.counts.working})`);
    for (const d of m.working) {
      const names = d.members.map((p) => (p.tags.length > 0 ? `${p.name} (${p.tags.join(", ")})` : p.name));
      L.push(`${colorEmoji(d.color)} ${d.name}: ${names.join(", ")}`);
    }
  }

  if (m.off.length > 0) {
    L.push("", `🏖️ FIESTA (${m.off.length})`);
    L.push(m.off.join(", "));
  }

  if (m.away.length > 0) {
    L.push("", `🌴 VACACIONES Y BAJAS (${m.counts.away})`);
    for (const g of m.away) {
      L.push(`${g.label}: ${g.members.map((p) => (p.reason ? `${p.name} (${p.reason})` : p.name)).join(", ")}`);
    }
  }

  if (m.missing.length > 0) {
    L.push("", `🔴 FALTAN (${m.missing.length})`);
    L.push(m.missing.map((p) => (p.reason ? `${p.name} (${p.reason})` : p.name)).join(", "));
  }

  if (m.times.length > 0) {
    L.push("", "⏰ HORARIOS");
    for (const t of m.times) L.push(`• ${t}`);
  }

  if (m.overtime) {
    L.push("", `⏱️ HORAS EXTRA (total ${m.overtime.total})`);
    for (const t of m.overtime.items) L.push(`• ${t}`);
  }

  if (m.notes.length > 0) {
    L.push("", "📝 NOTAS DE LA NOCHE");
    for (const t of m.notes) L.push(`• ${t}`);
  }

  if (m.missing.length === 0 && m.times.length === 0) {
    L.push("", "👍 Sin incidencias");
  }

  return L.join("\n");
}

import { REPORT_MODULES } from "./report-modules";
// Exportación del informe de la noche (texto con emojis e imagen). Sin zod: se usa también en el cliente.
import { formatOvertime } from "./overtime";
import { AGREEMENT_LABEL, type Agreement, groupNotesByWho, noteLine, noteWho } from "./notes";
import { formatStamp } from "./dates";
import type { ReportModule } from "./report-modules";
import type { DayReport } from "./report";

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

/** Una fila de la tabla de pasillos: departamento, quién lo ha hecho, hora, palés y nota. */
export interface ShareAisle {
  name: string;
  /** Departamento si es un pasillo separado (Leche › Droguería); null = es el departamento. */
  parent: string | null;
  color: string;
  people: string[];
  startTime: string | null;
  endTime: string | null;
  up: number | null;
  /** Bajados sin tocar. */
  down: number | null;
  /** Bajados por sobrante (cuentan como hechos). */
  surplus: number | null;
  done: number | null;
  note: string | null;
}

/** Totales de palés de la noche (suman los pasillos con datos). */
export interface SharePallets {
  up: number;
  down: number;
  surplus: number;
  done: number;
}

/** Datos de un pasillo en una línea de texto: «empezó 22:10 · 14 subidos · 2 bajados sin tocar · 3 sobrantes · 12 hechos». */
export function aisleDetails(a: ShareAisle): string[] {
  return [
    a.startTime && `empezó ${a.startTime}`,
    a.endTime && `acabó ${a.endTime}`,
    a.up !== null && `${a.up} ${a.up === 1 ? "subido" : "subidos"}`,
    a.down !== null && `${a.down} ${a.down === 1 ? "bajado" : "bajados"} sin tocar`,
    a.surplus !== null && `${a.surplus} ${a.surplus === 1 ? "sobrante" : "sobrantes"}`,
    a.done !== null && `${a.done} ${a.done === 1 ? "hecho" : "hechos"}`,
  ].filter((x): x is string => Boolean(x));
}

/** Una notificación a un empleado, con su firma y conformidad (si la ha firmado). */
export interface ShareNotification {
  who: string;
  text: string;
  agreement: Agreement | null;
  /** PNG (data URL) de la firma. */
  signature: string | null;
  /** «Mar 3 nov · 23:40». */
  signedAt: string | null;
  signedBy: string | null;
  photos: number;
}

export interface ShareModel {
  /** Módulos que esta vez no salen (se eligen en la página de Informe). */
  hidden: ReportModule[];
  title: string;
  shift: string;
  counts: { working: number; off: number; away: number; missing: number };
  /** Quién trabaja esta noche, por orden alfabético (sin separar por departamentos: eso va en la tabla de pasillos). */
  working: string[];
  off: string[];
  away: ShareAway[];
  missing: ShareMissing[];
  emptyDepartments: string[];
  times: string[];
  overtime: { total: string; items: string[] } | null;
  /** Notificaciones a empleados con su firma y conformidad. */
  notifications: ShareNotification[];
  /** Resumen de pasillos (control de pasillos); vacío si no se apuntó nada. */
  aisles: ShareAisle[];
  /** Palés de la noche en total (null si no hay palés apuntados). */
  pallets: SharePallets | null;
  /** Notas juntas por persona (o departamento); `who` null = generales. */
  notes: { who: string | null; items: string[]; /** Por nota: es una incidencia (en rojo en la imagen y el PDF). */ incident: boolean[] }[];
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

/**
 * 1.ª página del PDF: igual que la imagen pero sin las notas con foto (ya van en las páginas siguientes, cada foto con
 * su nota debajo); en su lugar, una línea que lo dice.
 */
export function pdfShareModel(report: DayReport, hidden: ReportModule[] = []): ShareModel {
  // Las notificaciones se quedan siempre en el informe (llevan la firma); sus fotos van además en su hoja.
  const keep = (n: DayReport["notes"][number]) => n.type === "NOTIFICATION" || n.photos.length === 0;
  const withPhotos = report.notes.filter((n) => !keep(n)).length;
  const m = buildShareModel({ ...report, notes: report.notes.filter(keep) }, hidden);
  if (withPhotos === 0) return m;
  if (hidden.includes("notes")) return m;
  const line = `📷 ${withPhotos === 1 ? "1 nota con foto" : `${withPhotos} notas con foto`}: en las páginas siguientes`;
  return { ...m, notes: [...m.notes, { who: null, items: [line], incident: [false] }] };
}

export function buildShareModel(report: DayReport, hidden: ReportModule[] = []): ShareModel {
  const show = (k: ReportModule) => !hidden.includes(k);
  // Trabajan: solo los nombres (el reparto por departamentos va en la tabla de pasillos, más abajo).
  const working = [...report.departments.flatMap((d) => d.members), ...report.unassigned]
    .map((m) => m.name)
    .sort((x, y) => x.localeCompare(y, "es"));

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

  // Las notificaciones van aparte (con su firma); el resto de notas, juntas por persona.
  const notifications: ShareNotification[] = report.notes
    .filter((n) => n.type === "NOTIFICATION")
    .map((n) => ({
      who: noteWho(n),
      text: n.text,
      agreement: n.agreement ?? null,
      signature: n.signature ?? null,
      signedAt: n.signedAt ? formatStamp(new Date(n.signedAt)) : null,
      signedBy: n.signedByName ?? null,
      photos: n.photos.length,
    }));
  const notes = groupNotesByWho(report.notes.filter((n) => n.type !== "NOTIFICATION")).map((g) => ({
    who: g.key === "general" ? null : g.who,
    // En una persona, el departamento de la nota va delante («Palets: …»).
    items: g.notes.map((n) => `${n.employeeId && n.departmentName ? `${n.departmentName}: ` : ""}${noteLine(n, false)}`),
    incident: g.notes.map((n) => n.type === "INCIDENT"),
  }));
  // El motivo de una falta sale como incidencia de esa persona (en «Faltan» solo va el nombre).
  for (const p of show("missing") && show("notes") ? missing : []) {
    if (!p.reason) continue;
    const item = `Incidencia: no ha venido — ${p.reason.replace(/\s*\n\s*/g, " ")}`;
    const own = notes.find((g) => g.who === p.name);
    if (own) {
      own.items.unshift(item);
      own.incident.unshift(true);
    } else notes.push({ who: p.name, items: [item], incident: [true] });
  }

  const aisles: ShareAisle[] = report.aisles.map((a) => ({
    name: a.name,
    parent: a.parent,
    color: a.color,
    people: a.people,
    startTime: a.startTime,
    endTime: a.endTime,
    up: a.palletsUp,
    down: a.palletsDown,
    surplus: a.palletsSurplus,
    done: a.done,
    note: a.note,
  }));
  const withPallets = aisles.filter((a) => a.up !== null || a.down !== null || a.surplus !== null);
  const sum = (f: (a: ShareAisle) => number | null) => aisles.reduce((n, a) => n + (f(a) ?? 0), 0);

  return {
    title: report.title,
    shift: `${report.shift.start}–${report.shift.end}`,
    hidden,
    counts: {
      working: report.presentCount,
      off: off.length,
      away: away.reduce((n, g) => n + g.members.length, 0),
      missing: missing.length,
    },
    working: show("working") ? working : [],
    off: show("off") ? off : [],
    away: show("away") ? away : [],
    missing: show("missing") ? missing : [],
    emptyDepartments: report.emptyDepartments,
    times: show("times") ? times : [],
    overtime:
      show("overtime") && report.overtime.items.length > 0
        ? {
            total: formatOvertime(report.overtime.totalMinutes),
            items: report.overtime.items.map(
              (o) =>
                `${o.name}: ${o.minutes !== 0 ? formatOvertime(o.minutes, true) : "sin tiempo"}${o.minutes < 0 ? " (retraso)" : o.recovers ? " (recupera retraso)" : ""}${o.note ? ` — ${o.note}` : ""}`,
            ),
          }
        : null,
    notifications: show("notifications") ? notifications : [],
    aisles: show("aisles") ? aisles : [],
    pallets:
      show("aisles") && withPallets.length > 0 ? { up: sum((a) => a.up), down: sum((a) => a.down), surplus: sum((a) => a.surplus), done: sum((a) => a.done) } : null,
    notes: show("notes") ? notes : [],
  };
}

/** Texto para WhatsApp/iMessage: emojis, títulos en mayúsculas y una línea por departamento (sin *asteriscos*: iMessage los muestra tal cual). Orden: trabajan → fiesta → vacaciones/bajas → faltan (🔴). */
export function shareModelToText(m: ShareModel): string {
  const L: string[] = [];
  L.push("🌙 INFORME DE NOCHE");
  L.push(`📅 ${m.title} · 🕘 ${m.shift}`);
  const on = (k: ReportModule) => !m.hidden.includes(k);
  const summary = [
    on("working") && `✅ ${m.counts.working} trabajan`,
    on("off") && m.counts.off > 0 && `🏖️ ${m.counts.off} fiesta`,
    on("away") && m.counts.away > 0 && `🌴 ${m.counts.away} vacaciones/baja`,
    on("missing") && m.counts.missing > 0 && `🔴 ${m.counts.missing} faltan`,
  ].filter(Boolean);
  if (summary.length > 0) L.push(summary.join(" · "));

  if (m.working.length > 0) {
    L.push("", `✅ TRABAJAN (${m.counts.working})`);
    L.push(m.working.join(", "));
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
    L.push(m.missing.map((p) => p.name).join(", "));
  }

  if (m.times.length > 0) {
    L.push("", "⏰ HORARIOS");
    for (const t of m.times) L.push(`• ${t}`);
  }

  if (m.overtime) {
    L.push("", `⏱️ HORAS EXTRA (total ${m.overtime.total})`);
    for (const t of m.overtime.items) L.push(`• ${t}`);
  }

  if (m.notifications.length > 0) {
    L.push("", `✍️ NOTIFICACIONES (${m.notifications.length})`);
    for (const n of m.notifications) {
      const status =
        n.agreement && n.signedAt
          ? `${n.agreement === "AGREE" ? "✅" : "❌"} ${AGREEMENT_LABEL[n.agreement]} · firmada${n.signedBy ? ` por ${n.signedBy}` : ""} (${n.signedAt})`
          : "⏳ Pendiente de firma";
      L.push(`• ${n.who}: ${n.text.replace(/\s*\n\s*/g, " ")} — ${status}`);
    }
  }

  if (m.notes.length > 0) {
    L.push("", "📝 NOTAS DE LA NOCHE");
    for (const g of m.notes) {
      if (!g.who) for (const t of g.items) L.push(`• ${t}`);
      else if (g.items.length === 1) L.push(`• ${g.who}: ${g.items[0]}`);
      else L.push(`• ${g.who}:`, ...g.items.map((t) => `   – ${t}`));
    }
  }

  if (m.aisles.length > 0) {
    L.push("", `📦 PASILLOS${m.pallets ? ` (${m.pallets.done} palés hechos)` : ""}`);
    for (const a of m.aisles) {
      const line = [a.people.join(", ") || "Grupo", ...aisleDetails(a), a.note && `Nota: ${a.note.replace(/\s*\n\s*/g, " ")}`].filter(Boolean);
      L.push(`${colorEmoji(a.color)} ${a.parent ? `${a.parent} › ` : ""}${a.name}: ${line.join(" · ")}`);
    }
  }

  if (on("missing") && on("times") && m.missing.length === 0 && m.times.length === 0) {
    L.push("", "👍 Sin incidencias");
  }

  return L.join("\n");
}

/** Módulos con contenido, siempre calculados con todos activados. */
export function availableModules(report: DayReport): ReportModule[] {
  const m = buildShareModel(report, []);
  return REPORT_MODULES.filter(({ key }) => key === "overtime" ? !!m.overtime : m[key].length > 0).map(({ key }) => key);
}

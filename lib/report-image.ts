// Imagen PNG del informe (canvas, solo cliente). Mismo contenido y orden que el texto: trabajan (solo nombres) → fiesta → vacaciones/bajas → faltan (en rojo) → … → tabla de pasillos.
import type { ShareModel } from "./report-share";

export const W = 1080;
export const PAD = 48;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
export const C = {
  bg: "#f2f2f7",
  card: "#ffffff",
  fg: "#1c1c1e",
  muted: "#6e6e73",
  line: "#e5e5ea",
  green: "#248a3d",
  greenBg: "#e3f5e7",
  blue: "#0a84ff",
  blueBg: "#e5f1ff",
  red: "#d70015",
  redBg: "#ffe5e7",
  purple: "#8944ab",
  purpleBg: "#f4e8fa",
  amber: "#b25000",
  amberBg: "#fff1dc",
};

export type Ctx = CanvasRenderingContext2D;

export function font(ctx: Ctx, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Parte un texto en líneas que caben en `max` px. */
export function wrap(ctx: Ctx, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Dibuja el informe. Con `draw` = false solo mide (devuelve la altura total).
 * Se llama dos veces: una para medir y otra sobre el canvas del tamaño justo.
 */
function paint(ctx: Ctx, m: ShareModel, draw: boolean): number {
  let y = PAD;
  const inner = W - PAD * 2;

  const text = (s: string, x: number, size: number, weight: number, color: string, maxW = inner) => {
    font(ctx, size, weight);
    const lines = wrap(ctx, s, maxW);
    for (const l of lines) {
      if (draw) {
        ctx.fillStyle = color;
        ctx.fillText(l, x, y + size);
      }
      y += Math.round(size * 1.3);
    }
  };

  /**
   * Línea compacta: [cuadrado de color] + **etiqueta** y a continuación el texto (nombres separados por comas),
   * que sigue en las líneas de abajo si no cabe.
   */
  const inline = (label: string, rest: string, swatch: string | null, color = C.fg) => {
    const size = 28;
    const lh = Math.round(size * 1.35);
    let x0 = PAD + 28;
    if (swatch) {
      if (draw) {
        ctx.fillStyle = swatch;
        roundRect(ctx, x0, y + 6, 26, 26, 7);
        ctx.fill();
      }
      x0 += 40;
    }
    const maxX = W - PAD - 28;
    font(ctx, size, 700);
    if (draw) {
      ctx.fillStyle = C.fg;
      ctx.fillText(label, x0, y + size);
    }
    let x = x0 + ctx.measureText(label).width + 12;
    font(ctx, size, 400);
    const space = ctx.measureText(" ").width;
    for (const word of rest.split(/ +/).filter(Boolean)) {
      const w = ctx.measureText(word).width;
      if (x + w > maxX && x > x0) {
        x = x0;
        y += lh;
      }
      if (draw) {
        ctx.fillStyle = color;
        ctx.fillText(word, x, y + size);
      }
      x += w + space;
    }
    y += lh + 8;
  };

  /** Tarjeta con cabecera de color; `body` dibuja dentro y avanza `y`. */
  const card = (title: string, color: string, bg: string, body: () => void) => {
    const top = y;
    // Primero se mide el contenido, luego se pinta el fondo y se vuelve a pintar encima.
    const run = (d: boolean) => {
      const saved = draw;
      draw = d;
      y = top;
      // cabecera
      if (draw) {
        ctx.fillStyle = bg;
        roundRect(ctx, PAD, y, inner, 72, 24);
        ctx.fill();
        ctx.fillRect(PAD, y + 40, inner, 32);
      }
      y += 18;
      const x0 = PAD + 28;
      if (draw) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x0 + 10, y + 18, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      font(ctx, 30, 700);
      if (draw) {
        ctx.fillStyle = color;
        ctx.fillText(title, x0 + 32, y + 29);
      }
      y += 54 + 16;
      body();
      y += 12;
      draw = saved;
      return y;
    };
    const bottom = run(false);
    if (draw) {
      ctx.fillStyle = C.card;
      roundRect(ctx, PAD, top, inner, bottom - top, 24);
      ctx.fill();
      run(true);
    }
    y = bottom + 24;
  };

  /** Viñeta en (x, y) con ancho `w`; devuelve el alto sin mover `y`. */
  const bulletAt = (x: number, w: number, s: string, color: string, dot: string): number => {
    const top = y;
    if (draw) {
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(x + 6, y + 19, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    text(s, x + 26, 28, 400, color, w - 26);
    const h = y - top + 6;
    y = top;
    return h;
  };
  const bullet = (s: string, color = C.fg, dot = C.muted) => {
    y += bulletAt(PAD + 32, inner - 64, s, color, dot);
  };

  // Cabecera
  text("🌙 Informe de noche", PAD, 52, 800, C.fg);
  y += 4;
  text(`${m.title} · ${m.shift}`, PAD, 30, 500, C.muted);
  y += 20;

  // Contadores
  const chips: [string, string, string][] = [
    [`${m.counts.working} trabajan`, C.green, C.greenBg],
    [`${m.counts.off} fiesta`, C.blue, C.blueBg],
    [`${m.counts.away} vac./baja`, C.purple, C.purpleBg],
    [`${m.counts.missing} faltan`, C.red, C.redBg],
  ];
  const gap = 16;
  const cw = (inner - gap * (chips.length - 1)) / chips.length;
  chips.forEach(([label, color, bg], i) => {
    const x = PAD + i * (cw + gap);
    if (draw) {
      ctx.fillStyle = bg;
      roundRect(ctx, x, y, cw, 88, 22);
      ctx.fill();
      font(ctx, 28, 700);
      ctx.fillStyle = color;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, x + (cw - tw) / 2, y + 56);
    }
  });
  y += 88 + 28;

  if (m.working.length > 0) {
    card(`Trabajan (${m.counts.working})`, C.green, C.greenBg, () => {
      text(m.working.join(", "), PAD + 28, 28, 400, C.fg, inner - 56);
      y += 6;
    });
  }

  if (m.off.length > 0) {
    card(`Fiesta (${m.off.length})`, C.blue, C.blueBg, () => {
      text(m.off.join(", "), PAD + 28, 28, 400, C.fg, inner - 56);
      y += 6;
    });
  }

  if (m.away.length > 0) {
    card(`Vacaciones y bajas (${m.counts.away})`, C.purple, C.purpleBg, () => {
      for (const g of m.away) {
        inline(`${g.label}:`, g.members.map((p) => (p.reason ? `${p.name} (${p.reason})` : p.name)).join(", "), null);
      }
    });
  }

  if (m.missing.length > 0) {
    card(`Faltan (${m.missing.length})`, C.red, C.redBg, () => {
      text(m.missing.map((p) => p.name).join(", "), PAD + 28, 28, 600, C.red, inner - 56);
      y += 6;
    });
  }

  if (m.times.length > 0) {
    card("Horarios", C.amber, C.amberBg, () => m.times.forEach((t) => bullet(t, C.fg, C.amber)));
  }
  if (m.overtime) {
    const o = m.overtime;
    card(`Horas extra · ${o.total}`, C.amber, C.amberBg, () => o.items.forEach((t) => bullet(t, C.fg, C.amber)));
  }
  if (m.notes.length > 0) {
    card("Notas de la noche", C.fg, C.line, () =>
      m.notes.forEach((g) => {
        // Incidencias en rojo; el resto de notas en negro.
        const color = (i: number) => (g.incident[i] ? C.red : C.fg);
        const dot = (i: number) => (g.incident[i] ? C.red : C.muted);
        if (!g.who) g.items.forEach((t, i) => bullet(t, color(i), dot(i)));
        else if (g.items.length === 1) bullet(`${g.who}: ${g.items[0]}`, color(0), dot(0));
        else {
          // Persona con varias notas: su nombre una vez y las notas debajo, sangradas.
          bullet(g.who);
          g.items.forEach((t, i) => (y += bulletAt(PAD + 64, inner - 96, t, color(i), dot(i))));
        }
      }),
    );
  }

  if (m.aisles.length > 0) {
    card(`Pasillos${m.pallets ? ` · ${m.pallets.done} palés hechos` : ""}`, C.blue, C.blueBg, () => {
      // Tabla: Pasillo | Personas | Subidos | Bajados (sin tocar y sobrante) | Hechos | Hora; la nota, debajo de su fila.
      const x0 = PAD + 28;
      const cols = [250, 270, 92, 120, 92, 104];
      const xs = cols.map((_, i) => x0 + cols.slice(0, i).reduce((a, b) => a + b, 0));
      const tableW = cols.reduce((a, b) => a + b, 0);
      const num = (n: number | null) => (n === null ? "–" : String(n));
      /** Texto envuelto en la columna [x, x+w): devuelve su alto sin mover `y`. `dy` = desplazamiento vertical. */
      const cell = (x: number, w: number, s: string, size: number, weight: number, color: string, center = false, dy = 0): number => {
        font(ctx, size, weight);
        const lh = Math.round(size * 1.3);
        const lines = wrap(ctx, s, w - 12);
        lines.forEach((l, i) => {
          if (draw) {
            ctx.fillStyle = color;
            ctx.fillText(l, center ? x + (w - ctx.measureText(l).width) / 2 : x + 6, y + dy + size + i * lh);
          }
        });
        return lines.length * lh;
      };
      const rule = () => {
        if (draw) {
          ctx.fillStyle = C.line;
          ctx.fillRect(x0, y, tableW, 2);
        }
        y += 2;
      };
      // Cabecera
      const heads = ["Pasillo", "Personas", "Subidos", "Bajados", "Hechos", "Hora"];
      const hh = Math.max(...heads.map((h, i) => cell(xs[i]!, cols[i]!, h, 22, 700, C.muted, i >= 2)));
      y += hh + 8;
      rule();
      for (const a of m.aisles) {
        y += 10;
        const top = y;
        if (draw) {
          ctx.fillStyle = a.color;
          roundRect(ctx, xs[0]! + 6, y + 6, 22, 22, 6);
          ctx.fill();
        }
        const heights = [
          cell(xs[0]! + 28, cols[0]! - 28, a.name, 26, 700, C.fg),
          cell(xs[1]!, cols[1]!, a.people.join(", ") || "Grupo", 24, 400, C.fg),
          cell(xs[2]!, cols[2]!, num(a.up), 26, 600, C.fg, true),
          0,
          cell(xs[4]!, cols[4]!, num(a.done), 26, 700, C.green, true),
          0,
        ];
        // Hora: la de inicio y, si hay, la de fin debajo en pequeño.
        let hh2 = cell(xs[5]!, cols[5]!, a.startTime ?? "–", 24, 400, C.fg, true);
        if (a.endTime) hh2 += cell(xs[5]!, cols[5]!, `a ${a.endTime}`, 20, 500, C.muted, true, hh2);
        heights[5] = hh2;
        // Bajados: sin tocar arriba y, si hay, el sobrante debajo en pequeño.
        let hb = cell(xs[3]!, cols[3]!, num(a.down), 26, 600, C.fg, true);
        if (a.surplus !== null) hb += cell(xs[3]!, cols[3]!, `+${a.surplus} sobr.`, 20, 500, C.muted, true, hb);
        heights[3] = hb;
        y = top + Math.max(...heights) + 8;
        if (a.note) {
          y += 2;
          y += cell(x0 + 28, tableW - 28, `Nota: ${a.note}`, 22, 400, C.muted) + 4;
        }
        y += 6;
        rule();
      }
      // Totales
      if (m.pallets) {
        y += 10;
        const top = y;
        const t = m.pallets;
        const hs = [
          cell(xs[0]!, cols[0]!, "Total", 26, 800, C.fg),
          cell(xs[2]!, cols[2]!, String(t.up), 26, 800, C.fg, true),
          cell(xs[3]!, cols[3]!, String(t.down) + (t.surplus > 0 ? `  +${t.surplus}` : ""), 26, 800, C.fg, true),
          cell(xs[4]!, cols[4]!, String(t.done), 26, 800, C.green, true),
        ];
        y = top + Math.max(...hs) + 6;
      }
      y += 6;
      text("Bajados = sin tocar (+ sobrante, que cuenta como hecho). Hechos = subidos − sin tocar.", x0, 20, 400, C.muted, tableW);
      y += 4;
    });
  }

  return y + PAD - 24;
}

/** El informe dibujado en un canvas (ancho 1080 px, alto el justo). */
export function renderReportCanvas(m: ShareModel): HTMLCanvasElement {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas no disponible");
  const height = Math.ceil(paint(probe, m, false));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, height);
  paint(ctx, m, true);
  return canvas;
}

export function canvasBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), type, quality),
  );
}

/** PNG del informe. */
export async function renderReportImage(m: ShareModel): Promise<Blob> {
  return canvasBlob(renderReportCanvas(m), "image/png");
}

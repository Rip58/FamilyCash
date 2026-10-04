// Imagen PNG del informe (canvas, solo cliente). Mismo contenido y orden que el texto: trabajan → fiesta → vacaciones/bajas → faltan (en rojo).
import type { ShareModel } from "./report-share";

const W = 1080;
const PAD = 48;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const C = {
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

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Parte un texto en líneas que caben en `max` px. */
function wrap(ctx: Ctx, text: string, max: number): string[] {
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

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
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
  /** Lista en dos columnas (listas largas de nombres). */
  const bullets2 = (items: string[], color: string, dot: string) => {
    const colW = (inner - 64) / 2;
    for (let i = 0; i < items.length; i += 2) {
      const a = bulletAt(PAD + 32, colW - 12, items[i]!, color, dot);
      const b = items[i + 1] !== undefined ? bulletAt(PAD + 32 + colW, colW - 12, items[i + 1]!, color, dot) : 0;
      y += Math.max(a, b);
    }
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
      m.working.forEach((d, i) => {
        if (i > 0) {
          if (draw) {
            ctx.fillStyle = C.line;
            ctx.fillRect(PAD + 28, y, inner - 56, 2);
          }
          y += 16;
        }
        const x = PAD + 28;
        if (draw) {
          ctx.fillStyle = d.color;
          roundRect(ctx, x, y + 4, 28, 28, 8);
          ctx.fill();
        }
        font(ctx, 30, 700);
        if (draw) {
          ctx.fillStyle = C.fg;
          ctx.fillText(d.name, x + 44, y + 29);
          const nw = ctx.measureText(d.name).width;
          font(ctx, 26, 500);
          ctx.fillStyle = C.muted;
          ctx.fillText(` · ${d.members.length}`, x + 44 + nw, y + 29);
        }
        y += 48;
        const names = d.members.map((p) => (p.tags.length > 0 ? `${p.name} · ${p.tags.join(" · ")}` : p.name));
        if (names.length >= 6) bullets2(names, C.fg, d.color);
        else for (const n of names) bullet(n, C.fg, d.color);
        y += 6;
      });
    });
  }

  if (m.off.length > 0) {
    card(`Fiesta (${m.off.length})`, C.blue, C.blueBg, () => {
      text(m.off.join(", "), PAD + 32, 28, 400, C.fg, inner - 64);
      y += 6;
    });
  }

  if (m.away.length > 0) {
    card(`Vacaciones y bajas (${m.counts.away})`, C.purple, C.purpleBg, () => {
      for (const g of m.away) {
        bullet(`${g.label}: ${g.members.map((p) => (p.reason ? `${p.name} (${p.reason})` : p.name)).join(", ")}`, C.fg, C.purple);
      }
    });
  }

  if (m.missing.length > 0 || m.emptyDepartments.length > 0) {
    card(m.missing.length > 0 ? `Faltan (${m.missing.length})` : "Departamentos vacíos", C.red, C.redBg, () => {
      for (const p of m.missing) bullet(`${p.name} — no ha venido${p.reason ? ` (${p.reason})` : ""}`, C.red, C.red);
      for (const d of m.emptyDepartments) bullet(`Sin personal en ${d}`, C.red, C.red);
    });
  }

  if (m.times.length > 0) {
    card("Horarios", C.amber, C.amberBg, () => m.times.forEach((t) => bullet(t, C.fg, C.amber)));
  }
  if (m.overtime) {
    const o = m.overtime;
    card(`Horas extra · ${o.total}`, C.amber, C.amberBg, () => o.items.forEach((t) => bullet(t, C.fg, C.amber)));
  }
  if (m.notes.length > 0) card("Notas de la noche", C.fg, C.line, () => m.notes.forEach((t) => bullet(t)));
  if (m.reports.length > 0) card("Avisos con foto", C.fg, C.line, () => m.reports.forEach((t) => bullet(t)));

  return y + PAD - 24;
}

/** PNG del informe. */
export async function renderReportImage(m: ShareModel): Promise<Blob> {
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
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png"),
  );
}

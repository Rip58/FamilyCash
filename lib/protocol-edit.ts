/* Ayudas del editor de protocolos: funciones puras sobre el texto y la selección. */

export interface EditResult {
  text: string;
  start: number;
  end: number;
}

const MAX_INDENT = 6;

function lineBounds(text: string, pos: number): [number, number] {
  const s = text.lastIndexOf("\n", pos - 1) + 1;
  const nl = text.indexOf("\n", pos);
  return [s, nl === -1 ? text.length : nl];
}

function replaceLine(text: string, start: number, end: number, fn: (line: string) => string): EditResult {
  const [ls, le] = lineBounds(text, start);
  const line = text.slice(ls, le);
  const next = fn(line);
  const delta = next.length - line.length;
  return {
    text: text.slice(0, ls) + next + text.slice(le),
    start: Math.max(ls, start + delta),
    end: Math.max(ls, end + delta),
  };
}

/** Convierte la línea actual en viñeta ("- ") conservando su sangría. */
export function makeBullet(text: string, start: number, end: number): EditResult {
  return replaceLine(text, start, end, (line) => {
    if (/^ *[-*] /.test(line)) return line;
    const indent = /^ */.exec(line)![0];
    return `${indent}- ${line.slice(indent.length)}`;
  });
}

/** Sangra la línea actual un nivel (2 espacios), convirtiéndola en viñeta si no lo era. */
export function indentLine(text: string, start: number, end: number): EditResult {
  const bulleted = makeBullet(text, start, end);
  return replaceLine(bulleted.text, bulleted.start, bulleted.end, (line) => {
    const indent = /^ */.exec(line)![0].length;
    return indent >= MAX_INDENT ? line : `  ${line}`;
  });
}

/** Quita un nivel de sangría de la línea actual. */
export function outdentLine(text: string, start: number, end: number): EditResult {
  return replaceLine(text, start, end, (line) => (line.startsWith("  ") ? line.slice(2) : line.replace(/^ /, "")));
}

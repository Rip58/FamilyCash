/** Parser mínimo de Markdown limitado para protocolos: listas anidadas, **negrita** y enlaces http(s). */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export interface ListItem {
  inline: Inline[];
  children: ListItem[];
}

export type Block = { type: "paragraph"; inline: Inline[] } | { type: "list"; items: ListItem[] };

const BULLET = /^( *)[-*] +(.*)$/;
const INLINE_RE = /\*\*([^*]+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function isSafeUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const push = (t: string) => {
    if (t) out.push({ type: "text", text: t });
  };
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (m[1] !== undefined) {
      push(text.slice(last, idx));
      out.push({ type: "bold", text: m[1] });
    } else if (m[2] !== undefined && m[3] !== undefined) {
      if (!isSafeUrl(m[3])) continue; // se deja como texto literal
      push(text.slice(last, idx));
      out.push({ type: "link", text: m[2], href: m[3] });
    } else continue;
    last = idx + m[0].length;
  }
  push(text.slice(last));
  return out;
}

export function parseProtocol(body: string): Block[] {
  const blocks: Block[] = [];
  let currentList: ListItem[] | null = null;
  // Pila de (nivel, lista) para anidar.
  let stack: { level: number; items: ListItem[] }[] = [];

  for (const rawLine of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/\t/g, "  ").replace(/\s+$/, "");
    if (!line.trim()) {
      currentList = null;
      stack = [];
      continue;
    }
    const m = BULLET.exec(line);
    if (!m) {
      currentList = null;
      stack = [];
      blocks.push({ type: "paragraph", inline: parseInline(line.trim()) });
      continue;
    }
    const level = Math.floor((m[1] ?? "").length / 2);
    const item: ListItem = { inline: parseInline((m[2] ?? "").trim()), children: [] };
    if (!currentList) {
      currentList = [];
      blocks.push({ type: "list", items: currentList });
      stack = [{ level: 0, items: currentList }];
    }
    // Sacar niveles más profundos que el actual.
    while (stack.length > 1 && stack[stack.length - 1]!.level > level) stack.pop();
    let top = stack[stack.length - 1]!;
    if (level > top.level) {
      // Anidar bajo el último elemento (un solo nivel por salto).
      const parent = top.items[top.items.length - 1];
      if (parent) {
        stack.push({ level: top.level + 1, items: parent.children });
        top = stack[stack.length - 1]!;
      }
    }
    top.items.push(item);
  }
  return blocks;
}

/** Texto plano de un cuerpo, para búsquedas. */
export function protocolPlainText(body: string): string {
  return body
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/^ *[-*] +/gm, "");
}

/** Minúsculas y sin acentos, con mapa de índices hacia el texto original. */
export function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const n = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let k = 0; k < n.length; k++) map.push(i);
    norm += n;
    i += ch.length;
  }
  return { norm, map };
}

export function normalize(text: string): string {
  return normalizeWithMap(text).norm;
}

/** Rangos [inicio, fin) de `query` dentro de `text`, ignorando acentos y mayúsculas. */
export function findRanges(text: string, query: string): [number, number][] {
  const q = normalize(query.trim());
  if (!q) return [];
  const { norm, map } = normalizeWithMap(text);
  const ranges: [number, number][] = [];
  let from = 0;
  for (;;) {
    const at = norm.indexOf(q, from);
    if (at === -1) break;
    const start = map[at]!;
    let end = map[at + q.length - 1]! + 1;
    while (end < text.length && /\p{M}/u.test(text[end]!)) end++;
    ranges.push([start, end]);
    from = at + q.length;
  }
  return ranges;
}

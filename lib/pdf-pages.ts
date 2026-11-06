/**
 * Reparto del informe en hojas (puro, sin DOM). El informe se pinta como una columna alta y se corta en hojas A4:
 * siempre entre bloques (`major` = el inicio de cada tarjeta) para que una tarjeta no quede partida, salvo que sea más
 * alta que una hoja (entonces se corta entre filas, `minor`).
 */
export interface PageBreaks {
  /** y donde empieza una tarjeta. */
  major: number[];
  /** y donde empieza una fila dentro de una tarjeta (se usa solo si una tarjeta no cabe en una hoja). */
  minor: number[];
}

/**
 * `total` = alto de todo el contenido; `firstH`/`nextH` = alto útil de la primera hoja y de las siguientes.
 * Devuelve los tramos [desde, hasta) de cada hoja.
 */
export function choosePageRanges(total: number, breaks: PageBreaks, firstH: number, nextH: number): [number, number][] {
  const major = [...breaks.major].sort((a, b) => a - b);
  const minor = [...breaks.minor].sort((a, b) => a - b);
  const last = (xs: number[]) => (xs.length > 0 ? xs[xs.length - 1]! : null);
  const suitableMinor = (from: number, limit: number, start: number) => {
    const candidates = minor.filter((b) => b > from + 1 && b <= limit);
    const balanced = candidates.filter((b) => {
      const cardStart = [...major].reverse().find((m) => m <= b) ?? 0;
      const cardEnd = major.find((m) => m > b) ?? total;
      return b - Math.max(cardStart, start) >= 160 && cardEnd - b >= 160;
    });
    return last(balanced) ?? last(candidates);
  };
  const out: [number, number][] = [];
  let start = 0;
  while (start < total) {
    const limit = start + (start === 0 ? firstH : nextH);
    if (limit >= total) {
      out.push([start, total]);
      break;
    }
    let cut = last(major.filter((b) => b > start + 1 && b <= limit));
    if (cut !== null) {
      // Si la tarjeta que empieza ahí no cabe en una hoja, se empieza en ésta y se corta entre sus filas.
      const next = major.find((b) => b > cut!) ?? total;
      if (next - cut > nextH) cut = suitableMinor(cut, limit, start) ?? cut;
    } else {
      cut = suitableMinor(start, limit, start);
    }
    if (cut === null || cut <= start) cut = limit;
    out.push([start, cut]);
    start = cut;
  }
  return out;
}

/** Ajusta el informe si una cola pequeña puede evitar una hoja. */
export function planPages(total: number, breaks: PageBreaks, firstH: number, nextH: number) {
  const ranges = choosePageRanges(total, breaks, firstH, nextH);
  const tail = ranges.at(-1);
  if (ranges.length > 1 && tail && tail[1] - tail[0] < nextH * 0.3) {
    for (const scale of [0.95, 0.9, 0.85]) {
      const candidate = choosePageRanges(total, breaks, firstH / scale, nextH / scale);
      if (candidate.length < ranges.length) return { scale, ranges: candidate };
    }
  }
  return { scale: 1, ranges };
}

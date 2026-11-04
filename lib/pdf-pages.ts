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
  const out: [number, number][] = [];
  let start = 0;
  while (start < total) {
    const limit = start + (start === 0 ? firstH : nextH);
    if (limit >= total - 1) {
      out.push([start, total]);
      break;
    }
    let cut = last(major.filter((b) => b > start + 1 && b <= limit));
    if (cut !== null) {
      // Si la tarjeta que empieza ahí no cabe en una hoja, se empieza en ésta y se corta entre sus filas.
      const next = major.find((b) => b > cut!) ?? total;
      if (next - cut > nextH) cut = last(minor.filter((b) => b > cut! + 1 && b <= limit)) ?? cut;
    } else {
      cut = last(minor.filter((b) => b > start + 1 && b <= limit));
    }
    if (cut === null || cut <= start) cut = limit;
    // Lo que queda es solo relleno: se queda en esta hoja.
    if (total - cut < 80) cut = total;
    out.push([start, cut]);
    start = cut;
  }
  return out;
}

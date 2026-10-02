import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Paso final de "Forzar actualización": pide al navegador que borre su caché HTTP de este sitio
 * (`Clear-Site-Data: "cache"`, sin tocar cookies ni datos guardados) y vuelve a la página indicada.
 * Se responde con HTML (no con redirección) porque algunos navegadores ignoran la cabecera en un 302.
 */
export function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("to") ?? "/hoy";
  // Solo rutas de esta app (evita redirecciones a otros sitios).
  const to = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/api/") ? raw : "/hoy";
  const target = JSON.stringify(to);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<noscript><meta http-equiv="refresh" content="0;url=${to.replace(/"/g, "%22")}"></noscript><title>Actualizando…</title>
<style>body{font:17px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#000;color:#fff}</style></head>
<body><p>Actualizando la app…</p><script>location.replace(${target});</script></body></html>`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Clear-Site-Data": '"cache"',
    },
  });
}

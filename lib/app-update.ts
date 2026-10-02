/**
 * Actualizar la app de verdad (cliente): borra service workers y cachés, pide al servidor que el navegador
 * vacíe su caché HTTP (/api/refresh) y, al volver, comprueba que ya está en la versión nueva; si no, reintenta.
 */
import { CLIENT_VERSION } from "./version";

const KEY = "app:update";
const MAX_TRIES = 2;

interface Pending {
  target: string | null;
  tries: number;
}

function read(): Pending | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function write(p: Pending | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: se actualiza igual, solo que sin verificación */
  }
}

/** Versión publicada ahora mismo (null si no se puede saber). */
export async function fetchServerVersion(): Promise<{ version: string; builtAt: string | null } | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { version: string; builtAt: string | null };
  } catch {
    return null;
  }
}

/** Fuerza la actualización. `target` = versión esperada (para comprobar al volver). */
export async function forceUpdate(target?: string | null, tries = 1): Promise<void> {
  write({ target: target ?? (await fetchServerVersion())?.version ?? null, tries });
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* seguir igualmente */
  }
  const here = window.location.pathname + window.location.search;
  window.location.replace(`/api/refresh?to=${encodeURIComponent(here)}&t=${Date.now()}`);
}

/**
 * Al cargar la app, tras un "Forzar actualización": "ok" si ya está en la versión nueva, "retry" si reintenta
 * (navega de nuevo), "failed" si tras varios intentos sigue en la vieja; null si no había nada pendiente.
 */
export function finishUpdate(): "ok" | "retry" | "failed" | null {
  const p = read();
  if (!p) return null;
  if (!p.target || p.target === CLIENT_VERSION) {
    write(null);
    return "ok";
  }
  if (p.tries < MAX_TRIES) {
    void forceUpdate(p.target, p.tries + 1);
    return "retry";
  }
  write(null);
  return "failed";
}

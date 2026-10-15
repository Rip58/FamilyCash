/**
 * Quién hace la petición en una Server Action (solo servidor). El proxy protege las rutas, pero las acciones se pueden
 * invocar desde cualquier página (también la pública del compañero, /turno), así que cada acción lo comprueba.
 */
import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

export class Unauthorized extends Error {
  constructor() {
    super("No autorizado");
  }
}

/** ¿Hay sesión del dueño de la app? */
export async function isOwner(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Solo el dueño (con sesión). Lanza si no. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) throw new Unauthorized();
}

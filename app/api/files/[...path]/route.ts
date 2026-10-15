import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { guestNightNow } from "@/lib/guest-server";
import { readStoredFile } from "@/lib/storage";

async function guestCanSee(pathname: string): Promise<boolean> {
  const night = await guestNightNow();
  if (!night) return false;
  return !!(await db.nightNotePhoto.findFirst({ where: { pathname, note: { date: toDbDate(night) } }, select: { id: true } }));
}

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Sirve las fotos (Vercel Blob privado o carpeta local). Las rutas acabadas en .jpg/.png/.webp no
 * pasan por el proxy, así que la sesión se comprueba aquí.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const jar = await cookies();
  const { path } = await params;
  const pathname = path.join("/");
  // El compañero (enlace sin contraseña) solo ve las fotos de las notas de la noche en curso.
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value)) && !(await guestCanSee(pathname))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const type = TYPES[pathname.split(".").pop() ?? ""];
  const data = type ? await readStoredFile(pathname) : null;
  if (!data || !type) return new NextResponse("No encontrado", { status: 404 });
  // El nombre lleva un sufijo aleatorio y nunca se reescribe: se puede cachear en el móvil.
  return new NextResponse(data, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

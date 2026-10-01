import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Sirve las fotos (Vercel Blob privado o carpeta local). Las rutas acabadas en .jpg/.png/.webp no
 * pasan por el proxy, así que la sesión se comprueba aquí.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const { path } = await params;
  const pathname = path.join("/");
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

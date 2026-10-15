import { NextResponse } from "next/server";
import { GUEST_TOKEN_RE, sameToken } from "@/lib/guest";
import { GUEST_COOKIE, currentGuestToken } from "@/lib/guest-server";

export const dynamic = "force-dynamic";

/** Cookie del compañero: larga; lo que puede tocar lo limita el servidor (noche en curso, hasta las 09:30). */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 120;

/**
 * Entrada del enlace del compañero (sin contraseña): si el código es el activo, guarda la cookie y abre /turno.
 * Cambiar o apagar el enlace en Ajustes deja sin acceso a quien tuviera el anterior.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!GUEST_TOKEN_RE.test(token) || !sameToken(token, await currentGuestToken())) {
    return new NextResponse("Este enlace no es válido o se ha desactivado. Pide el enlace nuevo.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const res = NextResponse.redirect(new URL("/turno", req.url));
  res.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

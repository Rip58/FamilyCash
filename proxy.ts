import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (ok) return NextResponse.redirect(new URL("/hoy", req.url));
    return NextResponse.next();
  }
  if (ok) return NextResponse.next();

  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Protege todo salvo assets, manifest e iconos.
  matcher: [
    "/((?!_next/static|_next/image|manifest\\.webmanifest|icon|apple-icon|favicon\\.ico|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)",
  ],
};

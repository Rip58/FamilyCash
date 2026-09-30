import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Versión desplegada ahora mismo en el servidor (la del último deploy). */
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev", builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

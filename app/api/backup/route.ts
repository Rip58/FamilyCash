import { NextResponse } from "next/server";
import { exportBackup } from "@/lib/backup";
import { madridToday } from "@/lib/dates";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Descarga la copia completa en JSON (protegida por la sesión en proxy.ts). */
export async function GET() {
  const backup = await exportBackup(db);
  return new NextResponse(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="familycash-copia-${madridToday()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { saveBackup } from "@/lib/backup-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Copia diaria (cron de Vercel, vercel.json). No pide sesión (proxy.ts la deja pasar): si existe `CRON_SECRET`,
 * Vercel manda `Authorization: Bearer <CRON_SECRET>` y se exige; sin él, solo hace la copia si aún no hay una de hoy,
 * así que llamarla de más no hace nada.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  try {
    const r = await saveBackup({ onlyIfMissing: true });
    return NextResponse.json({ ok: true, created: r.created, name: r.backup.name, size: r.backup.size, removed: r.removed });
  } catch (e) {
    console.error("Copia diaria fallida", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { isBackupName, readBackup } from "@/lib/backup-store";

export const dynamic = "force-dynamic";

/** Descarga una copia automática guardada (protegida por la sesión en proxy.ts). */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const data = isBackupName(name) ? await readBackup(name) : null;
  if (!data) return new NextResponse("No encontrada", { status: 404 });
  return new NextResponse(data as BodyInit, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

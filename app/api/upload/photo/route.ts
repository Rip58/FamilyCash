import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { BLOB_MISSING, blobMissing, saveStoredFile } from "@/lib/storage";
import { sniffImageType, validateUpload } from "@/lib/upload-rules";

export const dynamic = "force-dynamic";

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Recibe una foto ya comprimida (≤ 600 KB) y la guarda en Vercel Blob (privado) o, en desarrollo, en `.uploads/`. */
export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) return err("No autorizado", 401);
  // En Vercel el disco es de solo lectura: sin Vercel Blob no hay dónde guardar fotos.
  if (blobMissing()) return err(BLOB_MISSING, 503);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return err("Petición no válida.", 400);
  }
  if (!(file instanceof File)) return err("Falta el archivo.", 400);

  const declared = validateUpload(file.type, file.size);
  if (!declared.ok) return err(declared.error, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const real = sniffImageType(bytes);
  if (!real) return err("El archivo no es una imagen válida.", 400);

  try {
    return NextResponse.json(await saveStoredFile(bytes, real));
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? e.message : String(e);
    return err(`No se pudo guardar la foto en el servidor (${detail.slice(0, 160)}).`, 500);
  }
}

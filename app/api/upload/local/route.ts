import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { saveLocalFile, storageMode } from "@/lib/storage";
import { sniffImageType, validateUpload } from "@/lib/upload-rules";

export const dynamic = "force-dynamic";

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Modo desarrollo (sin BLOB_READ_WRITE_TOKEN): guarda la foto en `.uploads/`. */
export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) return err("No autorizado", 401);
  if (storageMode() !== "local") return err("La subida local está desactivada.", 404);

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

  const saved = await saveLocalFile(bytes, real);
  return NextResponse.json(saved);
}

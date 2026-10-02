import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { type ImportResult, importPrompt, importSchema, isAiProvider, toImportRows } from "@/lib/ai-import";
import { AiImportError, extractWithAi, providerModel } from "@/lib/ai-providers";
import { isDateStr, weekStart as weekStartOf } from "@/lib/dates";
import { getEmployees, getSettings, getStatusTypes } from "@/lib/queries";
import { sniffImageType } from "@/lib/upload-rules";

export const dynamic = "force-dynamic";
// Leer una imagen con la IA puede tardar ~30–60 s.
export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;
const err = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** Lee el cuadrante de una imagen con la IA elegida en Ajustes y devuelve la propuesta (no guarda nada). */
export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) return err("No autorizado", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Petición no válida.", 400);
  }
  const file = form.get("file");
  const week = String(form.get("weekStart") ?? "");
  if (!(file instanceof File)) return err("Falta la imagen.", 400);
  if (!isDateStr(week)) return err("Semana no válida.", 400);
  if (file.size > MAX_BYTES) return err("La imagen pesa demasiado (máx. 5 MB).", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return err("El archivo no es una imagen (JPEG, PNG o WebP).", 400);

  const [settings, employees, statusTypes] = await Promise.all([getSettings(), getEmployees(), getStatusTypes()]);
  const provider = isAiProvider(settings.aiProvider) ? settings.aiProvider : "claude";
  const weekStart = weekStartOf(week);
  const schema = importSchema(statusTypes.filter((s) => s.active !== false).map((s) => s.code));

  try {
    const out =
      process.env.AI_IMPORT_FAKE === "1" && !process.env.VERCEL
        ? fakeOutput(employees.filter((e) => e.active).slice(0, 4).map((e) => e.name))
        : await extractWithAi(
            provider,
            { data: Buffer.from(bytes).toString("base64"), mediaType: type as "image/jpeg" | "image/png" | "image/webp" },
            importPrompt({ weekStart, statusTypes, employees }),
            schema,
          );
    const result: ImportResult = {
      provider,
      model: providerModel(provider),
      detectedWeekStart: isDateStr(out.week_monday) ? weekStartOf(out.week_monday) : null,
      rows: toImportRows(out, employees, statusTypes),
      notes: out.notes.trim() || null,
    };
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof AiImportError) return err(e.message, 502);
    console.error(e);
    return err("No se pudo leer la imagen. Inténtalo de nuevo.", 500);
  }
}

/** Solo en local (AI_IMPORT_FAKE=1; nunca en Vercel): respuesta de ejemplo para probar la pantalla sin gastar IA. */
function fakeOutput(names: string[]) {
  const rot = ["WORK", "WORK", "OFF", "WORK", "WORK", "WORK", "OFF"];
  return {
    week_monday: "",
    rows: [
      ...names.map((name, i) => ({
        name: name.split(" ")[0]!,
        employee_id: "",
        days: Object.fromEntries(["L", "M", "X", "J", "V", "S", "D"].map((k, d) => [k, rot[(d + i) % 7]!])) as Record<
          "L" | "M" | "X" | "J" | "V" | "S" | "D",
          string
        >,
      })),
      { name: "Persona Desconocida", employee_id: "", days: { L: "VACATION", M: "VACATION", X: "?", J: "WORK", V: "WORK", S: "OFF", D: "OFF" } },
    ],
    notes: "Ejemplo de prueba (AI_IMPORT_FAKE).",
  };
}

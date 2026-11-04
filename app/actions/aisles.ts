"use server";

/** Control de pasillos (Hoy ⋯): hora de inicio y palés subidos/bajados de cada departamento esa noche. */
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { authorizeNight, logGuest } from "@/lib/guest-server";
import { REF_TAG } from "@/lib/queries";
import { requireOwner } from "@/lib/session";

const schema = z.object({
  date: z.string().refine(isDateStr),
  items: z
    .array(
      z.object({
        departmentId: z.string().min(1).max(64),
        /** "HH:mm" o null para borrar. */
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
        palletsUp: z.number().int().min(0).max(999).nullable(),
        palletsDown: z.number().int().min(0).max(999).nullable(),
        palletsSurplus: z.number().int().min(0).max(999).nullable(),
        note: z.string().trim().max(200).nullable(),
      }),
    )
    .min(1)
    .max(60),
});

export async function setAisleStarts(input: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  const { date, items } = p.data;
  const who = await authorizeNight(date);
  const d = toDbDate(date);
  try {
    await db.$transaction(
      items.map((it) =>
        it.startTime || it.palletsUp !== null || it.palletsDown !== null || it.palletsSurplus !== null || !!it.note
          ? db.aisleLog.upsert({
              where: { date_departmentId: { date: d, departmentId: it.departmentId } },
              create: { date: d, departmentId: it.departmentId, startTime: it.startTime, palletsUp: it.palletsUp, palletsDown: it.palletsDown, palletsSurplus: it.palletsSurplus, note: it.note || null },
              update: { startTime: it.startTime, palletsUp: it.palletsUp, palletsDown: it.palletsDown, palletsSurplus: it.palletsSurplus, note: it.note || null },
            })
          : db.aisleLog.deleteMany({ where: { date: d, departmentId: it.departmentId } }),
      ),
    );
  } catch {
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidatePath("/hoy", "layout");
  revalidatePath("/turno");
  if (who === "guest") {
    const deps = await db.department.findMany({ where: { id: { in: items.map((i) => i.departmentId) } }, select: { id: true, name: true } });
    const names = new Map(deps.map((x) => [x.id, x.name]));
    const text = items
      .map((i) => {
        const parts = [
          i.startTime && `empieza ${i.startTime}`,
          i.palletsUp !== null && `${i.palletsUp} subidos`,
          i.palletsDown !== null && `${i.palletsDown} bajados sin tocar`,
          i.palletsSurplus !== null && `${i.palletsSurplus} sobrantes`,
          i.note && `nota: ${i.note}`,
        ].filter(Boolean);
        return `${names.get(i.departmentId) ?? "Departamento"} ${parts.join(", ") || "borrado"}`;
      })
      .join(" · ");
    await logGuest(date, `Pasillos: ${text}`);
  }
  return { ok: true };
}

const hiddenSchema = z.object({ departmentId: z.string().min(1).max(64), hidden: z.boolean() });

/** El ojo del Control de pasillos: oculta (o vuelve a mostrar) un departamento en el control y en su resumen del informe. Solo el dueño. */
export async function setAisleHidden(input: z.input<typeof hiddenSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOwner();
  const p = hiddenSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  try {
    await db.department.update({ where: { id: p.data.departmentId }, data: { aisleHidden: p.data.hidden } });
  } catch {
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  updateTag(REF_TAG);
  revalidatePath("/", "layout");
  return { ok: true };
}

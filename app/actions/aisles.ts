"use server";

/** Control de pasillos (Hoy ⋯): hora de inicio y palés subidos/bajados de cada departamento esa noche. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { authorizeNight, logGuest } from "@/lib/guest-server";

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
        downSurplus: z.boolean(),
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
        it.startTime || it.palletsUp !== null || it.palletsDown !== null
          ? db.aisleLog.upsert({
              where: { date_departmentId: { date: d, departmentId: it.departmentId } },
              create: { date: d, departmentId: it.departmentId, startTime: it.startTime, palletsUp: it.palletsUp, palletsDown: it.palletsDown, downSurplus: it.downSurplus },
              update: { startTime: it.startTime, palletsUp: it.palletsUp, palletsDown: it.palletsDown, downSurplus: it.downSurplus },
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
          i.palletsDown !== null && `${i.palletsDown} bajados${i.downSurplus ? " (sobrante)" : ""}`,
        ].filter(Boolean);
        return `${names.get(i.departmentId) ?? "Departamento"} ${parts.join(", ") || "borrado"}`;
      })
      .join(" · ");
    await logGuest(date, `Pasillos: ${text}`);
  }
  return { ok: true };
}

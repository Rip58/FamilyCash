"use server";

/** Control de pasillos (Hoy ⋯): hora de inicio y fin, palés, nota y personal de cada pasillo (departamento o pasillo dentro de él) esa noche. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { authorizeNight, logGuest } from "@/lib/guest-server";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const schema = z.object({
  date: z.string().refine(isDateStr),
  items: z
    .array(
      z.object({
        departmentId: z.string().min(1).max(64),
        /** Pasillo dentro del departamento (Leche, Café…); null = el departamento entero. */
        sectionId: z.string().min(1).max(64).nullable(),
        /** Quién lo ha hecho (solo en pasillos con sección). */
        employeeIds: z.array(z.string().min(1).max(64)).max(40),
        /** "HH:mm" o null para borrar. */
        startTime: time.nullable(),
        endTime: time.nullable(),
        palletsUp: z.number().int().min(0).max(999).nullable(),
        palletsDown: z.number().int().min(0).max(999).nullable(),
        palletsSurplus: z.number().int().min(0).max(999).nullable(),
        note: z.string().trim().max(1000).nullable(),
      }),
    )
    .min(1)
    .max(80),
});

export async function setAisleStarts(input: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  const { date, items } = p.data;
  const who = await authorizeNight(date);
  if (!(await getSettings()).aislesEnabled) return { ok: false, error: "El control de pasillos está apagado (Ajustes)." };
  const d = toDbDate(date);
  // Un pasillo con sección tiene que ser de ese departamento.
  const secIds = [...new Set(items.flatMap((i) => (i.sectionId ? [i.sectionId] : [])))];
  const secs = secIds.length ? await db.section.findMany({ where: { id: { in: secIds } }, select: { id: true, name: true, departmentId: true } }) : [];
  const secById = new Map(secs.map((x) => [x.id, x]));
  if (items.some((i) => i.sectionId && secById.get(i.sectionId)?.departmentId !== i.departmentId)) return { ok: false, error: "Pasillo no válido." };
  try {
    await db.$transaction(
      items.map((it) => {
        const sectionKey = it.sectionId ?? "";
        const people = it.sectionId ? [...new Set(it.employeeIds)] : [];
        const has =
          it.startTime || it.endTime || it.palletsUp !== null || it.palletsDown !== null || it.palletsSurplus !== null || !!it.note || people.length > 0;
        return has
          ? db.aisleLog.upsert({
              where: { date_departmentId_sectionKey: { date: d, departmentId: it.departmentId, sectionKey } },
              create: {
                date: d, departmentId: it.departmentId, sectionId: it.sectionId, sectionKey, employeeIds: people,
                startTime: it.startTime, endTime: it.endTime, palletsUp: it.palletsUp, palletsDown: it.palletsDown,
                palletsSurplus: it.palletsSurplus, note: it.note || null,
              },
              update: {
                employeeIds: people, startTime: it.startTime, endTime: it.endTime, palletsUp: it.palletsUp,
                palletsDown: it.palletsDown, palletsSurplus: it.palletsSurplus, note: it.note || null,
              },
            })
          : // Sin datos: se borra la fila, salvo que el pasillo esté oculto esa noche.
            db.aisleLog.deleteMany({ where: { date: d, departmentId: it.departmentId, sectionKey, hidden: false } });
      }),
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
          i.endTime && `acaba ${i.endTime}`,
          i.palletsUp !== null && `${i.palletsUp} subidos`,
          i.palletsDown !== null && `${i.palletsDown} bajados sin tocar`,
          i.palletsSurplus !== null && `${i.palletsSurplus} sobrantes`,
          i.note && `nota: ${i.note}`,
        ].filter(Boolean);
        const label = i.sectionId ? `${names.get(i.departmentId) ?? "Departamento"} › ${secById.get(i.sectionId)?.name ?? "pasillo"}` : (names.get(i.departmentId) ?? "Departamento");
        return `${label} ${parts.join(", ") || "borrado"}`;
      })
      .join(" · ");
    await logGuest(date, `Pasillos: ${text}`);
  }
  return { ok: true };
}

const hiddenSchema = z.object({
  date: z.string().refine(isDateStr),
  departmentId: z.string().min(1).max(64),
  sectionId: z.string().min(1).max(64).nullable(),
  hidden: z.boolean(),
});

/** El ojo del Control de pasillos: oculta (o vuelve a mostrar) un pasillo en el resumen del informe SOLO esa noche. */
export async function setAisleHidden(input: z.input<typeof hiddenSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = hiddenSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  const { date, departmentId, sectionId, hidden } = p.data;
  const sectionKey = sectionId ?? "";
  const who = await authorizeNight(date);
  if (!(await getSettings()).aislesEnabled) return { ok: false, error: "El control de pasillos está apagado (Ajustes)." };
  const d = toDbDate(date);
  try {
    if (hidden) {
      await db.aisleLog.upsert({
        where: { date_departmentId_sectionKey: { date: d, departmentId, sectionKey } },
        create: { date: d, departmentId, sectionId, sectionKey, hidden: true },
        update: { hidden: true },
      });
    } else {
      await db.aisleLog.updateMany({ where: { date: d, departmentId, sectionKey }, data: { hidden: false } });
      // Si la fila no guarda nada más, se borra.
      await db.aisleLog.deleteMany({
        where: { date: d, departmentId, startTime: null, endTime: null, palletsUp: null, palletsDown: null, palletsSurplus: null, note: null },
      });
    }
  } catch {
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidatePath("/hoy", "layout");
  revalidatePath("/turno");
  revalidatePath("/informe", "layout");
  if (who === "guest") {
    const dep = (await db.department.findUnique({ where: { id: departmentId }, select: { name: true } }))?.name ?? "Departamento";
    const sec = sectionId ? (await db.section.findUnique({ where: { id: sectionId }, select: { name: true } }))?.name : null;
    await logGuest(date, `Pasillos: ${sec ? `${dep} › ${sec}` : dep} ${hidden ? "oculto esta noche" : "vuelve a mostrarse"}`);
  }
  return { ok: true };
}

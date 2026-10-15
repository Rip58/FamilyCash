"use server";

/**
 * Hoy en vivo: una «huella» barata de todo lo que se puede apuntar en una noche (lista, puestos, horas, notas y fotos,
 * Grupo, faltas y cambios del compañero). `useLiveNight` la consulta cada pocos segundos y, si cambia, refresca la
 * página: así lo que apunta el compañero en /turno sale en tu Hoy (y al revés) sin tener que salir y volver.
 */
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { authorizeNight } from "@/lib/guest-server";

const dateSchema = z.string().refine(isDateStr);

export async function nightVersion(date: string): Promise<string | null> {
  const p = dateSchema.safeParse(date);
  if (!p.success) return null;
  await authorizeNight(p.data);
  const d = toDbDate(p.data);
  const rows = await db.$queryRaw<{ v: string }[]>`
    SELECT concat_ws('|',
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '') FROM "DayEntry" WHERE "date" = ${d}),
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '') FROM "NightNote" WHERE "date" = ${d}),
      (SELECT count(*) FROM "NightNotePhoto" ph JOIN "NightNote" n ON n."id" = ph."noteId" WHERE n."date" = ${d}),
      (SELECT count(*) || ':' || coalesce(max("createdAt")::text, '') FROM "GroupCover" WHERE "date" = ${d}),
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '') FROM "Absence" WHERE "date" = ${d}),
      (SELECT count(*) FROM "GuestChange" WHERE "date" = ${d})
    ) AS v`;
  return rows[0]?.v ?? null;
}

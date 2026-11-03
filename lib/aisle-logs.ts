/** Control de pasillos: lecturas (solo servidor). Por ahora solo la hora a la que empezó cada departamento. */
import { type DateStr, toDbDate } from "./dates";
import { db } from "./db";

/** Hora de inicio ("HH:mm") por departamento de una noche. */
export async function getAisleStarts(date: DateStr): Promise<Record<string, string>> {
  const rows = await db.aisleLog.findMany({
    where: { date: toDbDate(date), startTime: { not: null } },
    select: { departmentId: true, startTime: true },
  });
  return Object.fromEntries(rows.map((r) => [r.departmentId, r.startTime!]));
}

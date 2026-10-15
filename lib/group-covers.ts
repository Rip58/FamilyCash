/** Marcas «Grupo»: departamentos sin nadie que esa noche hacen entre los compañeros (solo servidor). */
import { type DateStr, fromDbDate, toDbDate } from "./dates";
import { db } from "./db";

export async function getGroupCovers(from: DateStr, to: DateStr): Promise<{ date: DateStr; departmentId: string }[]> {
  const rows = await db.groupCover.findMany({
    where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
    select: { date: true, departmentId: true },
  });
  return rows.map((r) => ({ date: fromDbDate(r.date), departmentId: r.departmentId }));
}

/** Control de pasillos: lecturas (solo servidor). */
import type { AisleInfo } from "./aisle-format";
import { type DateStr, toDbDate } from "./dates";
import { db } from "./db";

/** Lo apuntado de cada departamento en una noche, por id de departamento. */
export async function getAisleLogs(date: DateStr): Promise<Record<string, AisleInfo>> {
  const rows = await db.aisleLog.findMany({
    where: { date: toDbDate(date) },
    select: { departmentId: true, startTime: true, palletsUp: true, palletsDown: true, palletsSurplus: true, note: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.departmentId, { startTime: r.startTime, palletsUp: r.palletsUp, palletsDown: r.palletsDown, palletsSurplus: r.palletsSurplus, note: r.note }]),
  );
}

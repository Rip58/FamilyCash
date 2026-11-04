/** Control de pasillos: lecturas (solo servidor). */
import { type AisleInfo, aisleKey } from "./aisle-format";
import { type DateStr, toDbDate } from "./dates";
import { db } from "./db";

/** Lo apuntado de cada pasillo en una noche, por clave (`aisleKey`: departamento o departamento:sección). */
export async function getAisleLogs(date: DateStr): Promise<Record<string, AisleInfo>> {
  const rows = await db.aisleLog.findMany({
    where: { date: toDbDate(date) },
    select: { departmentId: true, sectionId: true, employeeIds: true, startTime: true, endTime: true, palletsUp: true, palletsDown: true, palletsSurplus: true, note: true, hidden: true },
  });
  return Object.fromEntries(
    rows.map((r) => [aisleKey(r.departmentId, r.sectionId), { startTime: r.startTime, endTime: r.endTime, palletsUp: r.palletsUp, palletsDown: r.palletsDown, palletsSurplus: r.palletsSurplus, note: r.note, hidden: r.hidden, employeeIds: r.employeeIds }]),
  );
}

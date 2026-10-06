/** Registro de faltas (`Absence`, solo servidor): queda constancia aunque luego se cambie el día. */
import type { db } from "./db";
import { type AbsenceResolution, absenceSyncAction } from "./absence";
import { type DateStr, toDbDate } from "./dates";
import type { EffectiveDay } from "./schedule";

type Db = Pick<typeof db, "absence">;

/** Hoy guarda el estado y el «avisó» a la vez: si los dos crean el registro, el segundo choca (P2002) y se reintenta. */
async function retryOnConflict<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return fn();
    throw e;
  }
}

export async function syncAbsence(
  tx: Db,
  input: {
    employeeId: string;
    date: DateStr;
    before: EffectiveDay;
    after: EffectiveDay;
    source: "hoy" | "semana";
    /** Al resolver una falta desde Semana. */
    resolution?: { kind: AbsenceResolution; note: string };
  },
): Promise<void> {
  const { employeeId, date, before, after } = input;
  const where = { employeeId_date: { employeeId, date: toDbDate(date) } };
  const action = absenceSyncAction(input);
  if (action === "upsert") {
    await retryOnConflict(() =>
      tx.absence.upsert({
        where,
        create: { employeeId, date: toDbDate(date), statusLabel: after.status.label, reason: after.reason },
        update: { statusLabel: after.status.label, reason: after.reason, resolution: null, resolutionNote: null },
      }),
    );
  } else if (action === "delete-unresolved") {
    await tx.absence.deleteMany({ where: { employeeId, date: toDbDate(date), resolution: null } });
  } else if (action === "resolve") {
    const resolution = input.resolution ?? { kind: "CHANGED" as const, note: `cambiado a ${after.status.label.toLowerCase()}` };
    await tx.absence.upsert({
      where,
      create: {
        employeeId,
        date: toDbDate(date),
        statusLabel: before.status.label,
        reason: before.reason,
        resolution: resolution.kind,
        resolutionNote: resolution.note,
      },
      update: { resolution: resolution.kind, resolutionNote: resolution.note },
    });
  }
}

/** Avisó / no avisó (null = sin indicar). Crea el registro si aún no existe (con el estado indicado). */
export async function setAbsenceNotified(
  tx: Db,
  input: { employeeId: string; date: DateStr; notified: boolean | null; statusLabel: string },
): Promise<void> {
  await retryOnConflict(() =>
    tx.absence.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date: toDbDate(input.date) } },
      create: { employeeId: input.employeeId, date: toDbDate(input.date), statusLabel: input.statusLabel, notified: input.notified },
      update: { notified: input.notified },
    }),
  );
}

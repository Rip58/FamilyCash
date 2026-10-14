/** Lecturas de los temas de reunión (solo servidor). */
import { db } from "./db";
import { fromDbDate, madridToday } from "./dates";
import type { Prisma } from "./generated/prisma/client";
import type { MeetingTopicView } from "./meetings";

const include = { employee: { select: { name: true } }, department: { select: { name: true } } } as const;

type Row = Prisma.MeetingTopicGetPayload<{ include: typeof include }>;

function toView(r: Row): MeetingTopicView {
  return {
    id: r.id,
    text: r.text,
    employeeId: r.employeeId,
    employeeName: r.employee?.name ?? null,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    createdOn: madridToday(r.createdAt),
    doneOn: r.doneOn ? fromDbDate(r.doneOn) : null,
    outcome: r.outcome,
  };
}

/** Temas (todos, o los que cumplen `where`), del más antiguo al más nuevo. */
export async function findMeetingTopics(where: Prisma.MeetingTopicWhereInput = {}): Promise<MeetingTopicView[]> {
  const rows = await db.meetingTopic.findMany({ where, include, orderBy: { createdAt: "asc" } });
  return rows.map(toView);
}

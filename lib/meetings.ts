/**
 * Temas para las reuniones (Protocolos → Reuniones): se apuntan con quién (general, un departamento o una persona),
 * se marcan como tratados el día de la reunión y se puede añadir una valoración. Las reuniones pasadas son los temas
 * tratados agrupados por ese día. Puro y sin zod (también en el cliente).
 */
import type { DateStr } from "./dates";

export const MAX_MEETING_TEXT = 1000;

export interface MeetingTopicView {
  id: string;
  text: string;
  employeeId: string | null;
  employeeName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  /** Día en que se apuntó. */
  createdOn: DateStr;
  /** Día de la reunión en que se trató (null = pendiente). */
  doneOn: DateStr | null;
  /** Valoración / qué se acordó. */
  outcome: string | null;
}

export interface MeetingWho {
  /** employeeId, `dep:<id>` o "general". */
  key: string;
  label: string;
}

/** De quién es el tema: la persona, si no el departamento, si no «General». */
export function meetingWho(t: Pick<MeetingTopicView, "employeeId" | "employeeName" | "departmentId" | "departmentName">): MeetingWho {
  if (t.employeeId) return { key: t.employeeId, label: t.employeeName ?? "—" };
  if (t.departmentId) return { key: `dep:${t.departmentId}`, label: t.departmentName ?? "—" };
  return { key: "general", label: "General" };
}

/** «General» primero y el resto por orden alfabético. */
function byWho(a: MeetingWho, b: MeetingWho): number {
  return Number(b.key === "general") - Number(a.key === "general") || a.label.localeCompare(b.label, "es");
}

export interface MeetingGroup extends MeetingWho {
  topics: MeetingTopicView[];
}

/** Los temas de la misma persona (o departamento, o generales) juntos. Dentro, del más antiguo al más nuevo. */
export function groupTopicsByWho(topics: MeetingTopicView[]): MeetingGroup[] {
  const groups = new Map<string, MeetingGroup>();
  for (const t of topics) {
    const who = meetingWho(t);
    const g = groups.get(who.key) ?? { ...who, topics: [] };
    g.topics.push(t);
    groups.set(who.key, g);
  }
  return [...groups.values()].sort(byWho);
}

/** Para el selector de reuniones pasadas: solo los que tienen algún tema tratado. */
export function pastWhoOptions(topics: MeetingTopicView[]): MeetingWho[] {
  const seen = new Map<string, MeetingWho>();
  for (const t of topics) {
    if (!t.doneOn) continue;
    const who = meetingWho(t);
    if (!seen.has(who.key)) seen.set(who.key, who);
  }
  return [...seen.values()].sort(byWho);
}

export interface PastMeeting {
  date: DateStr;
  topics: MeetingTopicView[];
}

/** Reuniones pasadas (temas tratados por día), de la más reciente a la más antigua; con `whoKey`, solo esos temas. */
export function pastMeetings(topics: MeetingTopicView[], whoKey: string | null = null): PastMeeting[] {
  const days = new Map<DateStr, MeetingTopicView[]>();
  for (const t of topics) {
    if (!t.doneOn || (whoKey && meetingWho(t).key !== whoKey)) continue;
    days.set(t.doneOn, [...(days.get(t.doneOn) ?? []), t]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, topics: list }));
}

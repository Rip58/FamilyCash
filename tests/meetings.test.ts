import { describe, expect, it } from "vitest";
import { meetingHistoryItem } from "@/lib/employee-history";
import { type MeetingTopicView, groupTopicsByWho, meetingWho, pastMeetings, pastWhoOptions } from "@/lib/meetings";

let n = 0;
const topic = (over: Partial<MeetingTopicView> = {}): MeetingTopicView => ({
  id: `t${++n}`,
  text: "Tema",
  employeeId: null,
  employeeName: null,
  departmentId: null,
  departmentName: null,
  createdOn: "2026-10-01",
  doneOn: null,
  outcome: null,
  ...over,
});
const jorge = { employeeId: "e1", employeeName: "Jorge", departmentId: "d1", departmentName: "Droguería" };
const drog = { departmentId: "d1", departmentName: "Droguería" };

describe("de quién es el tema", () => {
  it("persona > departamento > general", () => {
    expect(meetingWho(topic(jorge))).toEqual({ key: "e1", label: "Jorge" });
    expect(meetingWho(topic(drog))).toEqual({ key: "dep:d1", label: "Droguería" });
    expect(meetingWho(topic())).toEqual({ key: "general", label: "General" });
  });
  it("agrupa con General primero y el resto por nombre", () => {
    const g = groupTopicsByWho([topic(jorge), topic(drog), topic(), topic(jorge)]);
    expect(g.map((x) => [x.label, x.topics.length])).toEqual([
      ["General", 1],
      ["Droguería", 1],
      ["Jorge", 2],
    ]);
  });
});

describe("reuniones pasadas", () => {
  const topics = [
    topic({ doneOn: "2026-10-06" }),
    topic({ ...jorge, doneOn: "2026-10-13", outcome: "Mejor" }),
    topic({ doneOn: "2026-10-13" }),
    topic({ ...drog }), // pendiente: no sale
  ];
  it("por día, la más reciente primero", () => {
    expect(pastMeetings(topics).map((m) => [m.date, m.topics.length])).toEqual([
      ["2026-10-13", 2],
      ["2026-10-06", 1],
    ]);
  });
  it("el selector solo ofrece a quien tiene algún tema tratado", () => {
    expect(pastWhoOptions(topics).map((o) => o.label)).toEqual(["General", "Jorge"]);
    expect(pastWhoOptions([topic({ doneOn: "2026-10-06" })]).map((o) => o.label)).toEqual(["General"]);
  });
  it("filtrar por Jorge deja solo sus reuniones y sus temas", () => {
    expect(pastMeetings(topics, "e1")).toEqual([{ date: "2026-10-13", topics: [topics[1]] }]);
  });
});

describe("historial del empleado", () => {
  it("tratado: el día de la reunión con la valoración; pendiente: el día que se apuntó", () => {
    expect(meetingHistoryItem(topic({ ...jorge, text: "Puntualidad", doneOn: "2026-10-13", outcome: "Mejor" }))).toMatchObject({
      date: "2026-10-13",
      kind: "meeting",
      label: "Reunión",
      text: "Puntualidad → Mejor",
    });
    expect(meetingHistoryItem(topic({ ...jorge, text: "Puntualidad" }))).toMatchObject({ date: "2026-10-01", label: "Para la reunión" });
  });
});

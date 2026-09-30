import { describe, expect, it } from "vitest";
import { formatStamp, madridInstant, madridTime } from "@/lib/dates";
import {
  buildTimeline, createNoteSchema, createRequestSchema, filterTimeline, groupByMonth, sortRequests,
  type NoteView,
} from "@/lib/employee-file";
import type { ReportView } from "@/lib/reports";

describe("madridInstant", () => {
  it("verano (UTC+2) e invierno (UTC+1)", () => {
    expect(madridInstant("2026-09-29", "23:40").toISOString()).toBe("2026-09-29T21:40:00.000Z");
    expect(madridInstant("2026-12-15", "23:40").toISOString()).toBe("2026-12-15T22:40:00.000Z");
  });
  it("ida y vuelta, también tras cambios de hora", () => {
    for (const [d, t] of [["2026-03-29", "01:30"], ["2026-03-29", "03:30"], ["2026-10-25", "01:30"], ["2026-10-25", "04:00"], ["2026-01-01", "00:00"]] as const) {
      expect(madridTime(madridInstant(d, t))).toBe(t);
    }
  });
  it("formatea la marca de tiempo en Madrid", () => {
    expect(formatStamp(madridInstant("2026-09-29", "23:40"))).toBe("Mar 29 sep · 23:40");
  });
  it("hora inválida", () => {
    expect(() => madridInstant("2026-09-29", "25:00")).toThrow();
  });
});

const note = (id: string, at: string, category: NoteView["category"] = "NOTE"): NoteView => ({
  id, occurredAt: at, category, text: id, photos: [],
});
const report = (id: string, createdDate: string, createdTime: string): ReportView => ({
  id, date: createdDate, text: id, employeeId: "e", employeeName: "E", sectionId: null, sectionName: null,
  createdTime, createdDate, photos: [],
});

describe("línea de tiempo", () => {
  const items = buildTimeline(
    [note("n1", "2026-09-29T21:40:00.000Z", "INCIDENT"), note("n2", "2026-08-31T21:30:00.000Z", "PRAISE")],
    [report("r1", "2026-09-30", "01:10")],
  );
  it("orden descendente mezclando avisos", () => {
    expect(items.map((i) => (i.kind === "note" ? i.note.id : i.report.id))).toEqual(["r1", "n1", "n2"]);
  });
  it("agrupa por mes de Madrid", () => {
    const g = groupByMonth(items);
    expect(g.map((x) => x.label)).toEqual(["Septiembre 2026", "Agosto 2026"]);
    expect(g[0]!.items).toHaveLength(2);
  });
  it("un evento a las 00:30 de Madrid del 1 va al mes nuevo", () => {
    const g = groupByMonth(buildTimeline([note("x", "2026-08-31T22:30:00.000Z")], []));
    expect(g[0]!.label).toBe("Septiembre 2026");
  });
  it("filtra por categoría y avisos", () => {
    expect(filterTimeline(items, "INCIDENT")).toHaveLength(1);
    expect(filterTimeline(items, "REPORT")).toHaveLength(1);
    expect(filterTimeline(items, null)).toHaveLength(3);
  });
});

describe("esquemas", () => {
  const photo = { url: "/api/files/reports/a.jpg", pathname: "reports/a.jpg", width: 10, height: 10, size: 5 };
  it("nota: texto obligatorio, hasta 6 fotos", () => {
    const ok = { employeeId: "e", date: "2026-09-29", time: "23:40", category: "NOTE", text: " hola ", photos: [photo] };
    expect(createNoteSchema.safeParse(ok).data?.text).toBe("hola");
    expect(createNoteSchema.safeParse({ ...ok, text: "  " }).success).toBe(false);
    expect(createNoteSchema.safeParse({ ...ok, photos: Array(7).fill(photo) }).success).toBe(false);
    expect(createNoteSchema.safeParse({ ...ok, category: "X" }).success).toBe(false);
    expect(createNoteSchema.safeParse({ ...ok, time: "9:5" }).success).toBe(false);
  });
  it("petición: valida el rango", () => {
    const ok = { employeeId: "e", type: "VACATION", dateFrom: "2026-10-12", dateTo: "2026-10-18", requestedAt: "2026-09-30" };
    expect(createRequestSchema.safeParse(ok).success).toBe(true);
    expect(createRequestSchema.safeParse({ ...ok, dateTo: "2026-10-01" }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...ok, dateTo: "2027-10-18" }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...ok, type: "SWAP_OFF", dateTo: "2026-10-12" }).success).toBe(false);
  });
});

describe("sortRequests", () => {
  it("pendientes primero", () => {
    const l = sortRequests([
      { id: "a", status: "APPROVED", requestedAt: "2026-09-01", dateFrom: "2026-10-01" },
      { id: "b", status: "PENDING", requestedAt: "2026-09-02", dateFrom: "2026-11-01" },
      { id: "c", status: "PENDING", requestedAt: "2026-09-03", dateFrom: "2026-10-05" },
      { id: "d", status: "DENIED", requestedAt: "2026-09-10", dateFrom: "2026-10-01" },
    ]);
    expect(l.map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
  });
});

import { describe, expect, it } from "vitest";
import { type ReminderView, describeReminder, dueOccurrence, lastOccurrence, nextOccurrence } from "@/lib/reminders";

// 2026-10-12 es lunes.
const MON = "2026-10-12";
const weekly = (over: Partial<ReminderView> = {}): ReminderView => ({
  id: "r",
  text: "Imprimir los horarios para firmar",
  weekdays: [0],
  date: null,
  time: "22:00",
  active: true,
  lastDone: null,
  snoozedUntil: null,
  ...over,
});

describe("recordatorios semanales", () => {
  it("el lunes antes de la hora aún no toca: el último fue el lunes anterior", () => {
    expect(lastOccurrence(weekly(), MON, "21:59")).toBe("2026-10-05");
    expect(nextOccurrence(weekly(), MON, "21:59")).toBe(MON);
  });
  it("a la hora en punto ya toca y el próximo es el lunes siguiente", () => {
    expect(lastOccurrence(weekly(), MON, "22:00")).toBe(MON);
    expect(nextOccurrence(weekly(), MON, "22:00")).toBe("2026-10-19");
  });
  it("sale hasta que se marca hecho, y vuelve el lunes siguiente", () => {
    expect(dueOccurrence(weekly({ lastDone: "2026-10-05" }), MON, "23:10", "2026-10-12T21:10:00Z")).toBe(MON);
    expect(dueOccurrence(weekly({ lastDone: MON }), "2026-10-13", "08:00", "2026-10-13T06:00:00Z")).toBeNull();
    expect(dueOccurrence(weekly({ lastDone: MON }), "2026-10-19", "22:05", "2026-10-19T20:05:00Z")).toBe("2026-10-19");
  });
  it("si no se abre la app el lunes, avisa el martes", () => {
    expect(dueOccurrence(weekly({ lastDone: "2026-10-05" }), "2026-10-13", "09:00", "2026-10-13T07:00:00Z")).toBe(MON);
  });
  it("aplazado o desactivado no sale", () => {
    expect(dueOccurrence(weekly({ snoozedUntil: "2026-10-12T21:00:00.000Z" }), MON, "22:30", "2026-10-12T20:30:00.000Z")).toBeNull();
    expect(dueOccurrence(weekly({ snoozedUntil: "2026-10-12T21:00:00.000Z" }), MON, "23:30", "2026-10-12T21:30:00.000Z")).toBe(MON);
    expect(dueOccurrence(weekly({ active: false }), MON, "23:00", "2026-10-12T21:00:00Z")).toBeNull();
  });
  it("varios días", () => {
    const r = weekly({ weekdays: [0, 3] });
    expect(nextOccurrence(r, "2026-10-13", "10:00")).toBe("2026-10-15");
    expect(lastOccurrence(r, "2026-10-16", "10:00")).toBe("2026-10-15");
  });
});

describe("recordatorio de un día", () => {
  const once = weekly({ weekdays: [], date: "2026-10-14", time: "06:30" });
  it("solo a partir de ese día y hora", () => {
    expect(lastOccurrence(once, "2026-10-14", "06:29")).toBeNull();
    expect(nextOccurrence(once, "2026-10-14", "06:29")).toBe("2026-10-14");
    expect(dueOccurrence(once, "2026-10-15", "00:00", "2026-10-14T22:00:00Z")).toBe("2026-10-14");
    expect(nextOccurrence(once, "2026-10-15", "00:00")).toBeNull();
    expect(dueOccurrence({ ...once, lastDone: "2026-10-14" }, "2026-10-15", "00:00", "2026-10-14T22:00:00Z")).toBeNull();
  });
});

describe("describeReminder", () => {
  it("en palabras", () => {
    expect(describeReminder(weekly())).toBe("Cada lunes a las 22:00");
    expect(describeReminder(weekly({ weekdays: [3, 0] }))).toBe("Lunes y jueves a las 22:00");
    expect(describeReminder(weekly({ weekdays: [0, 1, 2, 3, 4, 5, 6] }))).toBe("Cada día a las 22:00");
    expect(describeReminder(weekly({ weekdays: [], date: "2026-10-14" }))).toMatch(/^El miércoles .* a las 22:00$/);
  });
});

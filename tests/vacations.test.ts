import { describe, expect, it } from "vitest";
import { isTrivialPin, maxAtOnce, parseDepartmentMax, pickPin, vacationInvite, weekLabel } from "@/lib/vacations";

describe("PIN de vacaciones", () => {
  it("descarta los fáciles", () => {
    for (const p of ["0000", "1111", "1234", "4321", "6789", "123", "12a4"]) expect(isTrivialPin(p)).toBe(true);
    for (const p of ["4821", "1357", "0912"]) expect(isTrivialPin(p)).toBe(false);
  });
  it("nunca repite uno ya dado", () => {
    const taken = new Set(["4821"]);
    let n = 0;
    const seq = [0.4821, 0.4821, 0.1111, 0.5309];
    expect(pickPin(taken, () => seq[n++ % seq.length]!)).toBe("5309");
  });
  it("encuentra hueco aunque el azar falle", () => {
    const taken = new Set(Array.from({ length: 9000 }, (_, i) => String(i).padStart(4, "0")));
    const pin = pickPin(taken, () => 0);
    expect(taken.has(pin)).toBe(false);
    expect(isTrivialPin(pin)).toBe(false);
  });
});

describe("máximo a la vez", () => {
  const c = { defaultMax: 2, departmentMax: { drog: 1 } };
  it("por departamento, con el general para el resto", () => {
    expect(maxAtOnce(c, "drog")).toBe(1);
    expect(maxAtOnce(c, "bot")).toBe(2);
    expect(maxAtOnce(c, null)).toBe(2);
  });
  it("una semana con su propio máximo manda", () => {
    expect(maxAtOnce(c, "drog", { maxOverride: 3 })).toBe(3);
    expect(maxAtOnce(c, "drog", { maxOverride: null })).toBe(1);
  });
  it("lee el JSON de la BD sin fiarse", () => {
    expect(parseDepartmentMax({ a: 1, b: "2", c: -1, d: 1.5 })).toEqual({ a: 1 });
    expect(parseDepartmentMax(null)).toEqual({});
  });
});

describe("textos", () => {
  it("semana con su número y fechas", () => {
    expect(weekLabel("2027-07-26")).toBe("S30 · 26 jul – 1 ago");
  });
  it("mensaje para WhatsApp con enlace, PIN y plazo", () => {
    expect(vacationInvite("Cintya Sanchez", "https://x.app/vacaciones", "4821", { year: 2027, deadline: "2027-01-30" })).toBe(
      "Hola Cintya: elige tus vacaciones de 2027 aquí https://x.app/vacaciones con tu PIN 4821. Tienes hasta el 30/1/2027.",
    );
  });
});

import { checkVacations, countedDays, rangeLabel, vacationLockAfter, vacationSpan } from "@/lib/vacations";

const kinds = (s: ReturnType<typeof vacationSpan>) => s.days.map((d) => `${d.date.slice(5)}${d.kind === "work" ? "T" : "F"}`).join(" ");

describe("días de un periodo (22 laborables, 2 de fiesta por semana)", () => {
  it("semana entera: L–V descuentan, S–D son su fiesta", () => {
    const s = vacationSpan({ start: "2027-08-02", end: "2027-08-08" });
    expect(s.counted).toBe(5);
    expect(s.last).toBe("2027-08-08");
  });
  it("de lunes a viernes: se añaden sábado y domingo", () => {
    const s = vacationSpan({ start: "2027-08-02", end: "2027-08-06" });
    expect(s.counted).toBe(5);
    expect(s.last).toBe("2027-08-08");
  });
  it("3 días de miércoles a viernes: + sábado y domingo = 5 días, descuenta 3", () => {
    const s = vacationSpan({ start: "2027-07-07", end: "2027-07-09" });
    expect(kinds(s)).toBe("07-07T 07-08T 07-09T 07-10F 07-11F");
    expect(s.counted).toBe(3);
  });
  it("3 días de lunes a miércoles: la fiesta va al final (jueves y viernes)", () => {
    const s = vacationSpan({ start: "2027-07-05", end: "2027-07-07" });
    expect(kinds(s)).toBe("07-05T 07-06T 07-07T 07-08F 07-09F");
    expect(s.counted).toBe(3);
  });
  it("dos semanas y media: cada fin de semana es fiesta y la última semana completa sus 2", () => {
    const s = vacationSpan({ start: "2027-08-02", end: "2027-08-18" });
    expect(s.counted).toBe(13);
    expect(s.last).toBe("2027-08-20");
  });
  it("acabar en sábado: solo se añade el domingo", () => {
    expect(vacationSpan({ start: "2027-07-07", end: "2027-07-10" }).last).toBe("2027-07-11");
  });
  it("etiqueta con la fiesta incluida", () => {
    expect(rangeLabel({ start: "2027-07-07", end: "2027-07-09" })).toBe("7 jul – 11 jul");
  });
});

describe("comprobar lo que pide el empleado", () => {
  const rules = { year: 2027, workDays: 22, blocked: new Set(["2027-07-26"]) };
  it("vale si cabe en sus 22 días y no pisa nada", () => {
    const r = [{ start: "2027-08-02", end: "2027-08-15" }, { start: "2027-07-07", end: "2027-07-09" }];
    expect(checkVacations(r, rules)).toBeNull();
    expect(countedDays(r)).toBe(13);
  });
  it("no deja pasarse de los días", () => {
    const r = [{ start: "2027-03-01", end: "2027-04-04" }];
    expect(checkVacations(r, rules)).toBe("Te pasas: 25 de 22 días laborables.");
  });
  it("no deja coger una semana bloqueada", () => {
    expect(checkVacations([{ start: "2027-07-28", end: "2027-07-30" }], rules)).toMatch(/26 jul no se puede/);
  });
  it("la fiesta que se añade al final también cuenta para no pisarse", () => {
    const r = [{ start: "2027-07-05", end: "2027-07-07" }, { start: "2027-07-09", end: "2027-07-09" }];
    expect(checkVacations(r, rules)).toMatch(/se pisan/);
  });
  it("solo días del año y al menos uno de lunes a viernes", () => {
    expect(checkVacations([{ start: "2026-12-28", end: "2027-01-01" }], rules)).toMatch(/2027/);
    expect(checkVacations([{ start: "2027-07-10", end: "2027-07-11" }], rules)).toMatch(/al menos un día/);
  });
});

describe("bloqueo del PIN de vacaciones", () => {
  it("15 minutos cada 5 fallos", () => {
    const now = new Date("2027-01-10T10:00:00Z");
    expect(vacationLockAfter(4, now)).toBeNull();
    expect(vacationLockAfter(5, now)?.toISOString()).toBe("2027-01-10T10:15:00.000Z");
    expect(vacationLockAfter(10, now)).not.toBeNull();
  });
});

import { vacationWeekGrid, yearWeeks } from "@/lib/vacations";

describe("vista general de una semana", () => {
  const departments = [
    { id: "drog", name: "Droguería", color: "#0ea5e9", secondary: false },
    { id: "comod", name: "Comodín", color: "#999", secondary: true },
  ];
  const employees = [
    { id: "c", name: "Cintya", departmentId: "drog" },
    { id: "a", name: "Alex", departmentId: "drog" },
    { id: "f", name: "Fabian", departmentId: null },
    { id: "k", name: "Kim", departmentId: "comod" },
  ];
  const periods = [
    { employeeId: "c", start: "2027-08-02", end: "2027-08-13", status: "SENT" },
    { employeeId: "a", start: "2027-08-09", end: "2027-08-20", status: "SENT" },
    { employeeId: "f", start: "2027-08-11", end: "2027-08-13", status: "OK" },
    { employeeId: "k", start: "2027-08-09", end: "2027-08-13", status: "SENT" },
  ];
  const campaign = { defaultMax: 2, departmentMax: { drog: 1 } };

  it("cuenta por departamento y marca lo que pasa del máximo", () => {
    const g = vacationWeekGrid({ monday: "2027-08-09", employees, departments, periods, campaign, week: null });
    const drog = g.groups.find((x) => x.id === "drog")!;
    expect(drog.max).toBe(1);
    expect(drog.counts).toEqual([2, 2, 2, 2, 2, 0, 0]);
    expect(drog.over).toEqual([true, true, true, true, true, false, false]);
    expect(drog.rows[0]!.cells.join()).toBe("work,work,work,work,work,fiesta,fiesta");
    const none = g.groups.find((x) => x.id === "none")!;
    expect(none.rows[0]!.cells.join()).toBe(",,work,work,work,fiesta,fiesta");
    expect(none.over.some(Boolean)).toBe(false);
    expect(g.groups.find((x) => x.id === "comod")!.max).toBeNull();
    expect(g.overDays).toBe(5);
  });
  it("una semana con otro máximo lo cambia para todos los que cuentan", () => {
    const g = vacationWeekGrid({ monday: "2027-08-09", employees, departments, periods, campaign, week: { maxOverride: 2 } });
    expect(g.overDays).toBe(0);
  });
  it("semanas del año, la primera empieza en diciembre", () => {
    const w = yearWeeks(2027);
    expect(w[0]).toBe("2026-12-28");
    expect(w.at(-1)).toBe("2027-12-27");
    expect(w).toHaveLength(53);
  });
});

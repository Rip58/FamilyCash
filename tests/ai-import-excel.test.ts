import { describe, expect, it } from "vitest";
import { type ImportOutputLite as ImportOutput, importPrompt, importSchema, toImportRows } from "@/lib/ai-import";
import type { EmployeeLite, StatusTypeLite } from "@/lib/schedule";

/**
 * Las dos capturas reales del Excel (REPO NIT, semana 5–11 oct, en catalán), transcritas a mano tal y como
 * debería devolverlas la IA: nombres como se ven (en mayúsculas, cortados, con alguna errata) y estados por color.
 */
const st = (code: string, label: string, isWorking: boolean): StatusTypeLite => ({
  id: `st-${code}`, code, label, color: "#000", isWorking, sortOrder: 0,
});
const statusTypes = [
  st("WORK", "Trabaja", true), st("OFF", "Fiesta", false), st("PAID_OFF", "Fiesta retribuida", false),
  st("SICK", "Baja laboral", false), st("VACATION", "Vacaciones", false), st("ABSENT", "Faltante", false),
];
const NAMES = [
  "Alejandro Erwin", "Alejandro Gomez", "Alex Rivero", "Anya Damary Ramirez", "Cintya Sanchez", "Claudia Caceres", "Fabian",
  "Gerard Deu", "Hennry Arteta", "Joan Colldeforns", "Joao Marco Rosadas", "Jorge Alarcon", "Jose Alexander Roman",
  "Juan Pablo Zambrano", "Mariluz Carvajal", "Mikael Antunes", "Mimount Zarioh", "Neibis Vitoria", "Osmani Corominas",
  "Ricardo Luis Ayazo Baldovino", "Sebastian Cerda", "Sergi Ben Amor",
];
const employees: EmployeeLite[] = NAMES.map((name, i) => ({
  id: `e${i}`, name, defaultDepartmentId: null, sortOrder: i, fixedDaysOff: [], active: true,
}));
const T = "WORK", F = "OFF", V = "VACATION", B = "SICK", A = "ABSENT";
const row = (name: string, d: string[]) => ({
  name, employee_id: "", days: Object.fromEntries(["L", "M", "X", "J", "V", "S", "D"].map((k, i) => [k, d[i]!])) as ImportOutput["rows"][number]["days"],
});
const out: ImportOutput = {
  week_monday: "2026-10-05",
  notes: "",
  rows: [
    // Imagen de arriba (con cabecera y leyenda)
    row("GERARD DEU", [T, T, T, T, T, F, T]),
    row("JOSE ALEXANDER ROMAN", [T, T, T, T, F, T, T]),
    row("ALEJANDRO ERWIN", [T, T, T, T, T, F, T]),
    row("HENNRY ARTETA", [T, T, F, T, T, T, T]),
    row("MIMOUNT ZARIOH", [F, T, T, T, T, T, F]),
    row("RICARDO LUIS AYAZO BALI", [T, F, T, T, T, T, T]),
    row("CLAUDIA CACERES", [T, T, F, T, T, T, T]),
    row("JUAN PABLO ZAMBRANO", [T, T, F, T, T, T, T]),
    row("CINTYA SANCHEZ", [T, T, T, T, T, F, T]),
    row("MARILUZ CARVAJAL", [T, T, T, T, T, F, T]),
    row("ANYA DAMARY RAMIREZ", [T, T, T, T, T, T, F]),
    row("BRYAN", [T, F, F, T, T, T, T]),
    // Imagen de abajo (sin cabecera ni leyenda)
    row("ALEJANDRO GOMEZ", [F, T, T, T, T, T, T]),
    row("FATIMA", [T, F, F, T, T, T, T]),
    row("NEIBIS VITORIA", [F, T, T, T, T, T, F]),
    row("Joan Colldefons", [T, T, T, F, F, T, T]),
    row("JORGE ALARCON", [T, T, T, T, F, V, V]),
    row("FABIAN", [V, V, V, V, V, F, F]),
    row("ALEX RIVERO", [T, F, T, T, T, T, T]),
    row("OSMANI COROMINAS", [T, T, T, T, F, T, T]),
    row("MIKAEL ANTUNES", [A, A, A, A, A, A, A]),
    row("JOAO MARCO ROSADAS", [B, B, B, B, B, B, B]),
    row("SEBASTIAN CERDA", [B, B, B, B, B, B, B]),
    row("Sergi Ben Amor", [T, T, T, T, F, T, T]),
  ],
};

describe("cuadrante real (REPO NIT, 5–11 oct)", () => {
  const rows = toImportRows(out, employees, statusTypes);
  const byRead = new Map(rows.map((r) => [r.name, r]));
  const who = (read: string) => employees.find((e) => e.id === byRead.get(read)?.employeeId)?.name ?? null;

  it("empareja a todas las personas de la app, también con el nombre cortado o una errata", () => {
    expect(who("RICARDO LUIS AYAZO BALI")).toBe("Ricardo Luis Ayazo Baldovino");
    expect(who("Joan Colldefons")).toBe("Joan Colldeforns");
    expect(who("ALEJANDRO GOMEZ")).toBe("Alejandro Gomez");
    expect(who("ALEJANDRO ERWIN")).toBe("Alejandro Erwin");
    expect(who("Sergi Ben Amor")).toBe("Sergi Ben Amor");
    expect(who("FABIAN")).toBe("Fabian");
    // Todas las de la app aparecen una vez
    expect(new Set(rows.flatMap((r) => (r.employeeId ? [r.employeeId] : []))).size).toBe(NAMES.length);
  });

  it("quien no está en la app queda sin asignar (no se carga)", () => {
    expect(who("BRYAN")).toBeNull();
    expect(who("FATIMA")).toBeNull();
  });

  it("traduce los estados por día", () => {
    expect(byRead.get("JORGE ALARCON")!.cells).toEqual(["st-WORK", "st-WORK", "st-WORK", "st-WORK", "st-OFF", "st-VACATION", "st-VACATION"]);
    expect(byRead.get("JOAO MARCO ROSADAS")!.cells.every((c) => c === "st-SICK")).toBe(true);
  });

  it("las instrucciones explican la hoja, la leyenda de colores y varias imágenes", () => {
    const p = importPrompt({ weekStart: "2026-10-05", statusTypes, employees, imageCount: 2 });
    expect(p).toContain("2 imágenes");
    expect(p).toContain("POSICIO N");
    expect(p).toContain("Rojo OSCURO, granate = VACANCES / vacaciones → VACATION");
    expect(p).toContain("Rojo VIVO, brillante = BAIXA / baja → SICK");
    expect(p).toContain("Amarillo = FESTIU CALENDARI / festivo del calendario → PAID_OFF");
    // Sin estado de suspensión en la app: usa Faltante (ABSENT)
    expect(p).toContain("SUSPENSIÓ / suspensión → ABSENT");
    expect(p).toContain("TOTAL");
    // Si se crea el estado «Suspensión» en Ajustes, la IA lo usa
    const withSusp = [...statusTypes, st("SUSPENSION", "Suspensión", false)];
    expect(importPrompt({ weekStart: "2026-10-05", statusTypes: withSusp, employees })).toContain("suspensión → SUSPENSION");
  });
});

/**
 * Versión del 6 oct del mismo cuadrante (2 capturas; el usuario sube primero la parte de ABAJO). Transcrito a mano
 * de las fotos: la fila del corte (Anya, Alejandro Gomez) sale en las dos; Osmani tiene la fila entera en blanco.
 */
describe("cuadrante real, versión del 6 oct (2 imágenes, la de abajo primero)", () => {
  const U = "?";
  const out6: ImportOutput = {
    week_monday: "2026-10-05",
    notes: "OSMANI COROMINAS: fila entera en blanco.",
    rows: [
      // Imagen 1: parte de ABAJO (filas 41–75), sin cabecera
      row("ANYA DAMARY RAMIREZ", [T, T, T, T, T, F, T]),
      row("ALEJANDRO GOMEZ", [F, T, T, T, T, T, T]),
      row("NEIBIS VITORIA", [F, T, T, T, T, T, F]),
      row("Joan Colldeforns", [T, T, T, T, T, T, F]),
      row("JORGE ALARCON", [T, T, T, F, F, V, V]),
      row("FABIAN", [V, V, V, V, V, F, F]),
      row("ALEX RIVERO", [T, F, T, T, T, T, T]),
      row("OSMANI COROMINAS", [U, U, U, U, U, U, U]),
      row("MIKAEL ANTUNES", [T, T, F, F, T, T, T]),
      row("JOAO MARCO ROSADAS", [B, B, B, B, B, B, B]),
      row("SEBASTIAN CERDA", [B, B, B, B, B, B, B]),
      row("Sergi Ben Amor", [T, T, T, T, F, T, T]),
      // Imagen 2: parte de ARRIBA (filas 5–44), con cabecera y leyenda
      row("GERARD DEU", [T, F, T, T, T, T, T]),
      // Viernes con horario escrito pero sin horas del día (TOTAL 40): faltó.
      row("JOSE ALEXANDER ROMAN URREA", [T, T, T, T, A, F, T]),
      row("ALEJANDRO ERWIN", [T, T, T, T, T, F, T]),
      row("HENNRY ARTETA", [T, T, F, T, T, T, T]),
      row("MIMOUNT ZARIOH", [F, T, T, T, T, T, F]),
      row("RICARDO LUIS AYAZO BALDOVINO", [F, T, T, T, T, T, T]),
      row("CLAUDIA CACERES", [T, T, F, T, T, T, T]),
      row("JUAN PABLO ZAMBRANO", [T, T, F, T, T, T, T]),
      row("CINTYA SANCHEZ", [T, T, T, T, T, F, T]),
      row("MARILUZ CARVAJAL", [T, T, T, T, T, F, T]),
      row("ANYA DAMARY RAMIREZ", [T, T, T, T, T, F, T]),
      row("ALEJANDRO GOMEZ", [F, T, T, T, T, U, U]),
    ],
  };
  const rows = toImportRows(out6, employees, statusTypes);
  const cellsOf = (name: string) => {
    const id = employees.find((e) => e.name === name)!.id;
    return rows.find((r) => r.employeeId === id)?.cells.map((c) => c?.replace("st-", "") ?? U);
  };

  it("cada persona una sola vez aunque salga en las dos imágenes", () => {
    expect(rows).toHaveLength(NAMES.length);
    expect(new Set(rows.map((r) => r.employeeId).filter(Boolean)).size).toBe(NAMES.length);
  });

  it("estados por día como en el Excel", () => {
    expect(cellsOf("Gerard Deu")).toEqual([T, F, T, T, T, T, T]);
    expect(cellsOf("Jose Alexander Roman")).toEqual([T, T, T, T, A, F, T]);
    expect(cellsOf("Jorge Alarcon")).toEqual([T, T, T, F, F, V, V]);
    expect(cellsOf("Fabian")).toEqual([V, V, V, V, V, F, F]);
    expect(cellsOf("Mikael Antunes")).toEqual([T, T, F, F, T, T, T]);
    expect(cellsOf("Joao Marco Rosadas")).toEqual([B, B, B, B, B, B, B]);
    expect(cellsOf("Sebastian Cerda")).toEqual([B, B, B, B, B, B, B]);
    expect(cellsOf("Alejandro Gomez")).toEqual([F, T, T, T, T, T, T]);
  });

  it("la fila en blanco no se toca (todo «?»)", () => {
    expect(cellsOf("Osmani Corominas")).toEqual([U, U, U, U, U, U, U]);
  });

  it("las instrucciones avisan del orden de las imágenes y de la fila en blanco", () => {
    const p = importPrompt({ weekStart: "2026-10-05", statusTypes, employees, imageCount: 2 });
    expect(p).toContain("primero la parte de abajo");
    expect(p).toContain("fila ENTERA en blanco");
  });
});

describe("los dos rojos (vacaciones / baja)", () => {
  const p = importPrompt({ weekStart: "2026-10-05", statusTypes, employees, imageCount: 2 });
  it("las instrucciones explican granate = vacaciones y rojo vivo = baja, comparando entre filas", () => {
    expect(p).toContain("VACANCES = granate");
    expect(p).toContain("BAIXA = rojo VIVO");
    expect(p).toContain("el más oscuro es VACANCES y el más vivo es BAIXA");
  });
  it("la IA describe el color antes de los días (campo colors, antes de days)", () => {
    const shape = importSchema(["WORK"]).shape.rows.element.shape;
    const keys = Object.keys(shape);
    expect(keys.indexOf("colors")).toBeLessThan(keys.indexOf("days"));
  });
});

describe("empleados que ya no están activos", () => {
  it("no salen en la vista previa (Osmani ha plegado)", () => {
    const withInactive = employees.map((e) => (e.name === "Osmani Corominas" ? { ...e, active: false } : e));
    const r = toImportRows(
      { week_monday: "", notes: "", rows: [row("OSMANI COROMINAS", ["?", "?", "?", "?", "?", "?", "?"]), row("GERARD DEU", [T, T, T, T, T, T, F])] },
      withInactive,
      statusTypes,
    );
    expect(r.map((x) => x.name)).toEqual(["GERARD DEU"]);
  });
  it("el día con horario pero sin horas es falta", () => {
    expect(importPrompt({ weekStart: "2026-10-05", statusTypes, employees })).toContain("FALTÓ ese día → ABSENT");
  });
});

import { describe, expect, it } from "vitest";
import { importPrompt, importSchema, matchEmployee, toImportRows } from "@/lib/ai-import";
import type { EmployeeLite, StatusTypeLite } from "@/lib/schedule";

const emp = (id: string, name: string, alias: string | null = null): EmployeeLite => ({
  id, name, alias, defaultDepartmentId: null, sortOrder: 0, fixedDaysOff: [], active: true,
});
const st = (code: string, isWorking: boolean): StatusTypeLite => ({
  id: `st-${code}`, code, label: code, color: "#000", isWorking, sortOrder: 0,
});
const employees = [
  emp("a1", "Alejandro Gomez"),
  emp("a2", "Alejandro Erwin"),
  emp("c1", "Cintya Sanchez"),
  emp("j1", "Jose Alexander Roman", "Jose"),
];
const statusTypes = [st("WORK", true), st("OFF", false), st("VACATION", false), st("SICK", false)];

describe("asignar nombres leídos a empleados", () => {
  it("nombre completo, sin acentos ni mayúsculas", () => {
    expect(matchEmployee("CINTYA SÁNCHEZ", employees)?.id).toBe("c1");
  });
  it("nombre + inicial o apellido abreviado", () => {
    expect(matchEmployee("Alejandro G.", employees)?.id).toBe("a1");
    expect(matchEmployee("Alejandro Erw", employees)?.id).toBe("a2");
  });
  it("solo el nombre: vale si es único, no si hay dos iguales", () => {
    expect(matchEmployee("Cintya", employees)?.id).toBe("c1");
    expect(matchEmployee("Alejandro", employees)).toBeNull();
  });
  it("alias", () => {
    expect(matchEmployee("jose", employees)?.id).toBe("j1");
  });
  it("nadie parecido", () => {
    expect(matchEmployee("Pepito Pérez", employees)).toBeNull();
  });
});

describe("respuesta de la IA → vista previa", () => {
  const out = {
    week_monday: "2026-10-05",
    notes: "",
    rows: [
      { name: "Cintya", employee_id: "", days: { L: "WORK", M: "WORK", X: "OFF", J: "work", V: "VACATION", S: "?", D: "RARO" } },
      { name: "Alejandro G", employee_id: "a1", days: { L: "OFF", M: "WORK", X: "WORK", J: "WORK", V: "WORK", S: "WORK", D: "OFF" } },
      { name: "Alejandro Gomez", employee_id: "a1", days: { L: "SICK", M: "SICK", X: "SICK", J: "SICK", V: "SICK", S: "SICK", D: "SICK" } },
      { name: "Inventado", employee_id: "zzz", days: { L: "WORK", M: "WORK", X: "WORK", J: "WORK", V: "WORK", S: "WORK", D: "WORK" } },
    ],
  };
  const rows = toImportRows(out, employees, statusTypes);

  it("traduce códigos (sin importar mayúsculas) y deja null lo que no entiende", () => {
    expect(rows[0]).toEqual({
      name: "Cintya",
      employeeId: "c1",
      cells: ["st-WORK", "st-WORK", "st-OFF", "st-WORK", "st-VACATION", null, null],
    });
  });
  it("respeta el id que da la IA y no asigna a la misma persona dos veces", () => {
    expect(rows[1]!.employeeId).toBe("a1");
    expect(rows[2]!.employeeId).toBeNull();
  });
  it("ignora ids inventados", () => {
    expect(rows[3]!.employeeId).toBeNull();
  });
});

describe("petición a la IA", () => {
  it("el esquema acepta la respuesta y las instrucciones incluyen estados, personas y fechas", () => {
    const schema = importSchema(["WORK", "OFF"]);
    expect(schema.safeParse({ week_monday: "", notes: "", rows: [] }).success).toBe(true);
    const prompt = importPrompt({ weekStart: "2026-10-05", statusTypes, employees });
    expect(prompt).toContain("5 oct");
    expect(prompt).toContain("11 oct");
    expect(prompt).toContain("VACATION");
    expect(prompt).toContain("c1: Cintya Sanchez");
  });
});

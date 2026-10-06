import { describe, expect, it } from "vitest";
import { z } from "zod";
import { geminiFallbackModel, geminiSchema, importPrompt, importSchema, matchEmployee, toImportRows } from "@/lib/ai-import";
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
  it("respeta el id que da la IA y junta a la misma persona repetida (fila del corte entre 2 imágenes)", () => {
    expect(rows[1]!.employeeId).toBe("a1");
    expect(rows.filter((r) => r.employeeId === "a1")).toHaveLength(1);
    expect(rows).toHaveLength(3);
  });
  it("ignora ids inventados", () => {
    expect(rows[2]!.employeeId).toBeNull();
  });
  it("2 imágenes: la persona que sale en las dos completa los días que faltaban", () => {
    const r = toImportRows(
      {
        week_monday: "",
        notes: "",
        rows: [
          { name: "Cintya Sanchez", employee_id: "", days: { L: "WORK", M: "WORK", X: "?", J: "?", V: "?", S: "?", D: "?" } },
          { name: "Alejandro Erwin", employee_id: "", days: { L: "OFF", M: "WORK", X: "WORK", J: "WORK", V: "WORK", S: "WORK", D: "OFF" } },
          { name: "CINTYA SANCHEZ", employee_id: "", days: { L: "?", M: "OFF", X: "OFF", J: "WORK", V: "WORK", S: "WORK", D: "WORK" } },
        ],
      },
      employees,
      statusTypes,
    );
    expect(r.map((x) => x.employeeId)).toEqual(["c1", "a2"]);
    expect(r[0]!.cells).toEqual(["st-WORK", "st-WORK", "st-OFF", "st-WORK", "st-WORK", "st-WORK", "st-WORK"]);
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

describe("esquema para Gemini", () => {
  it("solo deja tipo, propiedades, requeridos, items y descripción", () => {
    const s = geminiSchema(z.toJSONSchema(importSchema(["WORK", "OFF"]))) as Record<string, unknown>;
    expect(s).not.toHaveProperty("$schema");
    expect(s).not.toHaveProperty("additionalProperties");
    expect(s.type).toBe("object");
    expect(s.required).toEqual(["week_monday", "rows", "notes"]);
    const rows = (s.properties as Record<string, Record<string, unknown>>).rows!;
    const item = rows.items as Record<string, unknown>;
    expect(item.required).toEqual(["name", "employee_id", "days"]);
    const days = (item.properties as Record<string, Record<string, unknown>>).days!;
    expect(days.propertyOrdering).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
    expect(JSON.stringify(s)).not.toContain("additionalProperties");
  });
});

describe("Gemini: modelo retirado", () => {
  const msg =
    "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.";
  it("usa el que sugiere el error", () => {
    expect(geminiFallbackModel(msg, [], "gemini-2.5-flash")).toBe("gemini-3.8-flash");
  });
  it("si no sugiere ninguno, el Flash más nuevo de la cuenta (sin lite/preview)", () => {
    const ids = ["gemini-2.5-pro", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.10-flash-preview", "gemini-3.8-flash"];
    expect(geminiFallbackModel("not found", ids, "gemini-2.5-flash")).toBe("gemini-3.8-flash");
    expect(geminiFallbackModel("not found", ["gemini-2.5-pro"], "gemini-2.5-flash")).toBeNull();
    // no vuelve a probar el mismo
    expect(geminiFallbackModel("use models/gemini-2.5-flash", [], "gemini-2.5-flash")).toBeNull();
  });
});

describe("nombre con un apellido más en el Excel", () => {
  it("«JOSE ALEXANDER ROMAN URREA» es Jose Alexander Roman", () => {
    expect(matchEmployee("JOSE ALEXANDER ROMAN URREA", employees)?.id).toBe("j1");
    expect(matchEmployee("ALEJANDRO PEREZ", employees)).toBeNull();
  });
});

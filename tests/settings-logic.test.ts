import { describe, expect, it } from "vitest";
import {
  arrayMove, isProtectedStatus, nextSortOrder, reorderIds, slugCode, sortOrderUpdates, uniqueCode,
} from "@/lib/settings-logic";
import { buildExportRows, csvEscape, daysInRange, toCsv } from "@/lib/export";
import type { EmployeeLite, StatusTypeLite } from "@/lib/schedule";

describe("códigos de estado", () => {
  it("genera code desde la etiqueta", () => {
    expect(slugCode("Fiesta retribuida")).toBe("FIESTA_RETRIBUIDA");
    expect(slugCode("  Baja  médica! ")).toBe("BAJA_MEDICA");
    expect(slugCode("¿¿??")).toBe("ESTADO");
  });
  it("evita colisiones", () => {
    expect(uniqueCode("Baja", ["SICK"])).toBe("BAJA");
    expect(uniqueCode("Baja", ["BAJA"])).toBe("BAJA_2");
    expect(uniqueCode("Baja", ["BAJA", "BAJA_2"])).toBe("BAJA_3");
  });
  it("protege WORK y OFF", () => {
    expect(isProtectedStatus("WORK")).toBe(true);
    expect(isProtectedStatus("OFF")).toBe(true);
    expect(isProtectedStatus("SICK")).toBe(false);
  });
});

describe("reordenación", () => {
  it("mueve y numera", () => {
    expect(reorderIds(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(reorderIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderIds(["a", "b"], "a", "zz")).toEqual(["a", "b"]);
    expect(arrayMove([1, 2, 3], 0, 9)).toEqual([1, 2, 3]);
    expect(sortOrderUpdates(["x", "y"])).toEqual([{ id: "x", sortOrder: 0 }, { id: "y", sortOrder: 1 }]);
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([0, 4, 2])).toBe(5);
  });
});

const statuses: StatusTypeLite[] = [
  { id: "w", code: "WORK", label: "Trabaja", color: "#000", isWorking: true, sortOrder: 0 },
  { id: "o", code: "OFF", label: "Fiesta", color: "#0f0", isWorking: false, sortOrder: 1 },
];
const emp = (id: string, name: string, fixed: number[], active = true): EmployeeLite => ({
  id, name, defaultDepartmentId: "d1", sortOrder: 0, fixedDaysOff: fixed, active,
});

describe("CSV", () => {
  it("escapa", () => {
    expect(csvEscape("hola")).toBe("hola");
    expect(csvEscape('a;b"c')).toBe('"a;b""c"');
    expect(toCsv([["a", "b\nc"]])).toBe('﻿a;"b\nc"\r\n');
  });
  it("rango de días", () => {
    expect(daysInRange("2026-09-28", "2026-09-30")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(daysInRange("2026-09-30", "2026-09-28")).toEqual([]);
  });
  it("incluye días por defecto, fijos y excepciones", () => {
    // 2026-09-28 es lunes
    const rows = buildExportRows({
      from: "2026-09-28", to: "2026-09-29",
      employees: [emp("e1", "Ana", [1]), emp("e2", "Baja", [], false)],
      departments: [{ id: "d1", name: "Droguería", color: "#000", sortOrder: 0, targetStaff: 1 }],
      statusTypes: statuses,
      sections: [{ id: "s1", name: "Cerveza" }],
      entries: [{
        employeeId: "e1", date: "2026-09-28", statusTypeId: "w", departmentId: null, reason: null,
        arrivedAt: "22:15", leftAt: null, timeReason: "tarde",
        segments: [{ sectionId: "s1", label: null, start: "21:30", end: "05:00", note: null, sortOrder: 0 }],
      }],
      notes: [{ date: "2026-09-28", employeeId: "e1", text: "ok" }, { date: "2026-09-28", employeeId: null, text: "general" }],
    });
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(["2026-09-28", "Ana", "Droguería", "Trabaja", "", "22:15", "", "tarde", "ok", "Cerveza 21:30-05:00", "", ""]);
    expect(rows[2]![3]).toBe("Fiesta"); // martes = día fijo
  });
});

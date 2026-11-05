import { describe, expect, it } from "vitest";
import { hiddenModulesParam, parseHiddenModules } from "@/lib/report-modules";

describe("módulos del informe", () => {
  it("lee ?sin= (solo módulos válidos, sin repetir)", () => {
    expect(parseHiddenModules(undefined)).toEqual([]);
    expect(parseHiddenModules("aisles,notes")).toEqual(["aisles", "notes"]);
    expect(parseHiddenModules("aisles, nada ,aisles")).toEqual(["aisles"]);
    expect(parseHiddenModules(["times", "off"])).toEqual(["times", "off"]);
  });
  it("lo escribe siempre en el mismo orden (y vacío si salen todos)", () => {
    expect(hiddenModulesParam([])).toBe("");
    expect(hiddenModulesParam(["aisles", "working", "notes"])).toBe("working,notes,aisles");
  });
});

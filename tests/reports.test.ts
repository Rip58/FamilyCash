import { describe, expect, it } from "vitest";
import {
  type ReportView,
  createReportSchema,
  photoCountLabel,
  purgeCutoff,
  reportsToTextLines,
  updateReportSchema,
} from "@/lib/reports";

const photo = (n: number) => ({
  url: `/api/files/reports/p${n}.jpg`,
  pathname: `reports/p${n}.jpg`,
  width: 1600,
  height: 1200,
  size: 300_000,
});

describe("createReportSchema", () => {
  it("acepta un aviso válido y normaliza opcionales", () => {
    const r = createReportSchema.parse({ date: "2026-09-29", text: "  Palé roto  ", photos: [photo(1)] });
    expect(r.text).toBe("Palé roto");
    expect(r.employeeId).toBeNull();
    expect(r.sectionId).toBeNull();
    expect(r.photos).toHaveLength(1);
  });
  it("el texto es obligatorio", () => {
    expect(createReportSchema.safeParse({ date: "2026-09-29", text: "   ", photos: [] }).success).toBe(false);
  });
  it("máximo 6 fotos", () => {
    const six = Array.from({ length: 6 }, (_, i) => photo(i));
    expect(createReportSchema.safeParse({ date: "2026-09-29", text: "x", photos: six }).success).toBe(true);
    expect(createReportSchema.safeParse({ date: "2026-09-29", text: "x", photos: [...six, photo(9)] }).success).toBe(false);
  });
  it("rechaza fecha inválida y fotos con URL/ruta incoherentes", () => {
    expect(createReportSchema.safeParse({ date: "29/09/2026", text: "x" }).success).toBe(false);
    const bad = { ...photo(1), url: "https://evil.example.com/reports/p1.jpg" };
    expect(createReportSchema.safeParse({ date: "2026-09-29", text: "x", photos: [bad] }).success).toBe(false);
    const traversal = { ...photo(1), pathname: "reports/../.env", url: "/api/files/reports/../.env" };
    expect(createReportSchema.safeParse({ date: "2026-09-29", text: "x", photos: [traversal] }).success).toBe(false);
  });
});

describe("updateReportSchema", () => {
  it("exige id y texto", () => {
    expect(updateReportSchema.safeParse({ id: "a", text: "ok" }).success).toBe(true);
    expect(updateReportSchema.safeParse({ id: "a", text: "" }).success).toBe(false);
  });
});

describe("purgeCutoff", () => {
  it("resta meses naturales", () => {
    expect(purgeCutoff("2026-09-30", 6)).toBe("2026-03-30");
    expect(purgeCutoff("2026-01-15", 2)).toBe("2025-11-15");
  });
  it("ajusta al último día del mes", () => {
    expect(purgeCutoff("2026-03-31", 1)).toBe("2026-02-28");
    expect(purgeCutoff("2024-05-31", 3)).toBe("2024-02-29");
  });
  it("cruza años", () => {
    expect(purgeCutoff("2026-06-10", 12)).toBe("2025-06-10");
    expect(purgeCutoff("2026-06-10", 18)).toBe("2024-12-10");
  });
});

describe("reportsToTextLines", () => {
  const base: ReportView = {
    id: "1", date: "2026-09-29", text: "Palé roto\nen pasillo", employeeId: "e", employeeName: "Gerard Deu",
    sectionId: null, sectionName: null, createdTime: "23:10", createdDate: "2026-09-29", photos: [],
  };
  it("vacío -> sin líneas", () => {
    expect(reportsToTextLines([])).toEqual([]);
  });
  it("incluye empleado, sección y nº de fotos", () => {
    const lines = reportsToTextLines([
      { ...base, photos: [1, 2].map((n) => ({ id: String(n), url: "u", width: 1, height: 1, size: 1 })) },
      { ...base, employeeName: null, sectionName: "Cerveza", text: "Sin foto" },
    ]);
    expect(lines).toEqual([
      "",
      "*Avisos con foto*",
      "• Gerard Deu: Palé roto en pasillo (2 fotos)",
      "• Sin foto [Cerveza]",
    ]);
  });
  it("singular", () => {
    expect(photoCountLabel(1)).toBe("1 foto");
    expect(photoCountLabel(3)).toBe("3 fotos");
  });
});

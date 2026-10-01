import { describe, expect, it } from "vitest";
import {
  createPlanogramSchema,
  removedPathnames,
  stepsSchema,
  untilLabel,
  untilState,
} from "@/lib/planograms";

const photo = { url: "/api/files/reports/a.webp", pathname: "reports/a.webp", width: 1600, height: 900, size: 90000 };

describe("lineales", () => {
  it("estado y texto de la fecha 'hasta'", () => {
    expect(untilState(null, "2026-10-01")).toBe("none");
    expect(untilState("2026-09-30", "2026-10-01")).toBe("expired");
    expect(untilState("2026-10-01", "2026-10-01")).toBe("soon");
    expect(untilState("2026-10-04", "2026-10-01")).toBe("soon");
    expect(untilState("2026-10-05", "2026-10-01")).toBe("ok");
    expect(untilLabel(null, "2026-10-01")).toBeNull();
    expect(untilLabel("2026-10-01", "2026-10-01")).toBe("Hasta hoy");
    expect(untilLabel("2026-10-02", "2026-10-01")).toBe("Hasta mañana");
    expect(untilLabel("2026-10-15", "2026-10-01")).toBe("Hasta 15 oct");
    expect(untilLabel("2026-09-28", "2026-10-01")).toBe("Caducado el 28 sep");
  });

  it("exige al menos una foto y valida la fecha", () => {
    expect(createPlanogramSchema.safeParse({ text: "x", photos: [] }).success).toBe(false);
    const ok = createPlanogramSchema.parse({ locationId: "", text: "  Promo ", until: "", photos: [photo] });
    expect(ok).toMatchObject({ locationId: null, text: "Promo", until: null });
    expect(createPlanogramSchema.safeParse({ text: "", until: "2026-13-01", photos: [photo] }).success).toBe(false);
  });

  it("rechaza fotos con URL que no corresponde a su ruta", () => {
    const bad = { ...photo, url: "https://evil.example/x.webp" };
    expect(createPlanogramSchema.safeParse({ text: "", photos: [bad] }).success).toBe(false);
  });
});

describe("pasos de protocolo", () => {
  it("cada paso necesita texto o foto", () => {
    expect(stepsSchema.safeParse([{ text: "  " }]).success).toBe(false);
    expect(stepsSchema.parse([{ text: "", photo }])[0]?.photo?.pathname).toBe("reports/a.webp");
    expect(stepsSchema.parse([{ text: " Pulsa PARO " }])).toEqual([{ text: "Pulsa PARO", photo: null }]);
    expect(stepsSchema.parse(undefined)).toEqual([]);
  });

  it("detecta las fotos que dejan de usarse", () => {
    expect(removedPathnames(["a", "b", null, "b"], ["b", null])).toEqual(["a"]);
    expect(removedPathnames([null], [])).toEqual([]);
  });
});

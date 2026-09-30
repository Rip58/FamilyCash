import { describe, expect, it } from "vitest";
import { compareVersions, formatBuildTime } from "@/lib/version";

describe("version", () => {
  it("compara versiones", () => {
    expect(compareVersions("abc1234", "abc1234")).toBe("same");
    expect(compareVersions("abc1234", "def5678")).toBe("outdated");
    expect(compareVersions("abc1234", null)).toBe("unknown");
  });
  it("formatea la hora de build en Madrid", () => {
    expect(formatBuildTime("2026-09-30T12:20:00Z")).toMatch(/30 sept?, 14:20/);
    expect(formatBuildTime(null)).toBe("—");
    expect(formatBuildTime("x")).toBe("—");
  });
});

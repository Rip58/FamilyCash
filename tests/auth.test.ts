import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-0123456789abcdef";
});

describe("sesión", () => {
  it("token válido se verifica", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });
  it("rechaza vacío, basura y token con otro secreto", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("abc.def.ghi")).toBe(false);
    const token = await createSessionToken();
    process.env.AUTH_SECRET = "otro-secreto-0123456789abcdef";
    expect(await verifySessionToken(token)).toBe(false);
    process.env.AUTH_SECRET = "test-secret-0123456789abcdef";
  });
});

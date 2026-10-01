import { describe, expect, it } from "vitest";
import { blobAuth } from "@/lib/blob-auth";

describe("credenciales de Vercel Blob", () => {
  it("sin variables: no hay almacén", () => {
    expect(blobAuth({})).toBeNull();
    expect(blobAuth({ EDGE_CONFIG_STORE_ID: "ecfg_x" })).toBeNull();
  });
  it("token clásico, también con prefijo", () => {
    expect(blobAuth({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc" })).toEqual({ token: "vercel_blob_rw_abc" });
    expect(blobAuth({ FOTOS_READ_WRITE_TOKEN: "vercel_blob_rw_def" })).toEqual({ token: "vercel_blob_rw_def" });
  });
  it("conexión nueva por id de almacén (OIDC)", () => {
    expect(blobAuth({ BLOB_STORE_ID: "store_123" })).toEqual({ storeId: "store_123" });
    expect(blobAuth({ FAMILYCASH_FOTOS_STORE_ID: "store_456" })).toEqual({ storeId: "store_456" });
  });
  it("el token tiene prioridad sobre el id", () => {
    expect(blobAuth({ BLOB_STORE_ID: "store_1", BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" })).toEqual({ token: "vercel_blob_rw_x" });
  });
});

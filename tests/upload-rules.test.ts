import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  extensionFor,
  formatBytes,
  isPhotoUrlFor,
  isSafePathname,
  sniffImageType,
  validateUpload,
} from "@/lib/upload-rules";

describe("validateUpload", () => {
  it("acepta jpeg/png/webp dentro del límite", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp"]) expect(validateUpload(t, 1000).ok).toBe(true);
    expect(validateUpload("image/jpeg", MAX_UPLOAD_BYTES).ok).toBe(true);
  });
  it("rechaza otros tipos, vacíos y > 8 MB", () => {
    expect(validateUpload("image/gif", 1000).ok).toBe(false);
    expect(validateUpload("application/pdf", 1000).ok).toBe(false);
    expect(validateUpload("image/jpeg", 0).ok).toBe(false);
    expect(validateUpload("image/jpeg", MAX_UPLOAD_BYTES + 1).ok).toBe(false);
  });
  it("extensiones", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("text/html")).toBeNull();
  });
});

describe("sniffImageType", () => {
  it("detecta por firma", () => {
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
  });
  it("rechaza contenido no imagen", () => {
    expect(sniffImageType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("isSafePathname / isPhotoUrlFor", () => {
  it("solo rutas relativas bajo reports/ sin trucos", () => {
    expect(isSafePathname("reports/abc-123.jpg")).toBe(true);
    expect(isSafePathname("reports/foto-Ab12.jpg")).toBe(true);
    for (const bad of ["../etc/passwd", "reports/../x.jpg", "/reports/a.jpg", "other/a.jpg", "reports//a.jpg", "reports/a b.jpg", "reports\\a.jpg"]) {
      expect(isSafePathname(bad)).toBe(false);
    }
  });
  it("la URL debe corresponder al pathname", () => {
    expect(isPhotoUrlFor("/api/files/reports/a.jpg", "reports/a.jpg")).toBe(true);
    expect(isPhotoUrlFor("/api/files/reports/b.jpg", "reports/a.jpg")).toBe(false);
    expect(isPhotoUrlFor("https://abc.public.blob.vercel-storage.com/reports/a-XyZ.jpg", "reports/a-XyZ.jpg")).toBe(true);
    expect(isPhotoUrlFor("https://evil.example.com/reports/a.jpg", "reports/a.jpg")).toBe(false);
    expect(isPhotoUrlFor("http://abc.public.blob.vercel-storage.com/reports/a.jpg", "reports/a.jpg")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("formatea", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(300 * 1024)).toBe("300 KB");
    expect(formatBytes(5.5 * 1024 * 1024)).toBe("5,5 MB");
  });
});

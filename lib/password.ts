import "server-only";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Comprueba la contraseña: si Settings.passwordHash existe se usa bcrypt;
 * si no, se compara (tiempo constante) con APP_PASSWORD.
 */
export async function checkPassword(input: string): Promise<boolean> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings?.passwordHash) return bcrypt.compare(input, settings.passwordHash);
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { madridTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { GUEST_PIN_RE, afterWrongPin } from "@/lib/guest";
import { GUEST_COOKIE } from "@/lib/guest-server";
import { checkPassword } from "@/lib/password";

const loginSchema = z.object({
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/hoy";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Introduce la contraseña." };

  if (!(await checkPassword(parsed.data.password))) {
    return { error: "Contraseña incorrecta." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  redirect(safeNext(parsed.data.next));
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

// ---- Compañero (/turno + PIN de 4 dígitos) ---------------------------------

export type GuestPinResult = { ok: true } | { ok: false; error: string };

/**
 * PIN del compañero: si es el bueno, guarda la cookie `guest` (con el secreto actual, que cambia con cada PIN nuevo).
 * Contra quien intente adivinarlo: cada 5 fallos seguidos, 15 min de bloqueo; a los 20 se apaga el acceso.
 */
export async function enterGuestPin(input: { pin: string }): Promise<GuestPinResult> {
  const pin = typeof input?.pin === "string" ? input.pin.trim() : "";
  const s = await db.settings.findUnique({
    where: { id: 1 },
    select: { guestToken: true, guestPinHash: true, guestFails: true, guestLockedUntil: true },
  });
  if (!s?.guestToken || !s.guestPinHash) return { ok: false, error: "El acceso del compañero está apagado." };
  const now = new Date();
  if (s.guestLockedUntil && s.guestLockedUntil > now) {
    return { ok: false, error: `Demasiados intentos. Vuelve a probar a las ${madridTime(s.guestLockedUntil)}.` };
  }
  if (!GUEST_PIN_RE.test(pin)) return { ok: false, error: "El PIN son 4 números." };
  if (!(await bcrypt.compare(pin, s.guestPinHash))) {
    // Contador atómico: dos intentos a la vez no se saltan el bloqueo.
    const { guestFails } = await db.settings.update({ where: { id: 1 }, data: { guestFails: { increment: 1 } }, select: { guestFails: true } });
    const next = afterWrongPin(guestFails - 1, now);
    if (next.disable) {
      await db.settings.update({ where: { id: 1 }, data: { guestToken: null, guestPinHash: null, guestLockedUntil: null } });
      return { ok: false, error: "Demasiados intentos: el acceso se ha apagado. Pide que pongan un PIN nuevo." };
    }
    if (next.lockedUntil) {
      await db.settings.update({ where: { id: 1 }, data: { guestLockedUntil: next.lockedUntil } });
      return { ok: false, error: `PIN incorrecto. Demasiados intentos: vuelve a probar a las ${madridTime(next.lockedUntil)}.` };
    }
    return { ok: false, error: "PIN incorrecto." };
  }
  await db.settings.update({ where: { id: 1 }, data: { guestFails: 0, guestLockedUntil: null } });
  const jar = await cookies();
  jar.set(GUEST_COOKIE, s.guestToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 120,
  });
  return { ok: true };
}

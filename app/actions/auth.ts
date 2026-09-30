"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth";
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

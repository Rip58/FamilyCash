"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const fieldsSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título.").max(120, "Título demasiado largo."),
  category: z
    .string()
    .trim()
    .max(60, "Categoría demasiado larga.")
    .optional()
    .transform((v) => (v ? v : null)),
  body: z.string().max(20000, "El texto es demasiado largo."),
});

const idSchema = z.string().min(1).max(64);

function fail(e: z.ZodError): ActionResult {
  return { ok: false, error: e.issues[0]?.message ?? "Datos no válidos." };
}

export async function createProtocol(input: unknown): Promise<ActionResult> {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const last = await db.protocol.aggregate({ _max: { sortOrder: true } });
  const created = await db.protocol.create({
    data: { ...parsed.data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/protocolos");
  return { ok: true, id: created.id };
}

export async function updateProtocol(id: unknown, input: unknown): Promise<ActionResult> {
  const pid = idSchema.safeParse(id);
  const parsed = fieldsSchema.safeParse(input);
  if (!pid.success) return { ok: false, error: "Protocolo no válido." };
  if (!parsed.success) return fail(parsed.error);
  try {
    await db.protocol.update({ where: { id: pid.data }, data: parsed.data });
  } catch {
    return { ok: false, error: "El protocolo ya no existe." };
  }
  revalidatePath("/protocolos");
  return { ok: true, id: pid.data };
}

export async function deleteProtocol(id: unknown): Promise<ActionResult> {
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Protocolo no válido." };
  await db.protocol.deleteMany({ where: { id: pid.data } });
  revalidatePath("/protocolos");
  return { ok: true };
}

/**
 * Reordena un grupo de protocolos (los de una categoría): recibe sus ids en el
 * nuevo orden y reparte entre ellos los mismos valores de `sortOrder` que ya
 * ocupaban, sin alterar la posición de las demás categorías.
 */
export async function reorderProtocols(ids: unknown): Promise<ActionResult> {
  const parsed = z.array(idSchema).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Orden no válido." };
  const rows = await db.protocol.findMany({
    where: { id: { in: parsed.data } },
    select: { id: true, sortOrder: true },
  });
  if (rows.length !== new Set(parsed.data).size) return { ok: false, error: "Faltan protocolos." };
  const slots = rows.map((r) => r.sortOrder).sort((a, b) => a - b);
  // Si hay valores repetidos, se desplazan para que el orden sea estricto.
  for (let i = 1; i < slots.length; i++) if (slots[i]! <= slots[i - 1]!) slots[i] = slots[i - 1]! + 1;
  await db.$transaction(
    parsed.data.map((pid, i) => db.protocol.update({ where: { id: pid }, data: { sortOrder: slots[i]! } })),
  );
  revalidatePath("/protocolos");
  return { ok: true };
}

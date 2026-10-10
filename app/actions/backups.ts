"use server";

import { revalidatePath } from "next/cache";
import { saveBackup } from "@/lib/backup-store";

/** «Hacer copia ahora» (Ajustes → Datos y fotos): guarda la copia de hoy en el almacén, sobrescribiendo la de hoy. */
export async function backupNow(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveBackup();
    revalidatePath("/ajustes/datos");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "No se pudo hacer la copia. Comprueba que el almacenamiento está conectado." };
  }
}

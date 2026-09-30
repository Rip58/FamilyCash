"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StorageMode } from "@/lib/upload";

const Ctx = createContext<StorageMode>("local");

/** Expone al cliente el modo de almacenamiento decidido en el servidor. */
export function StorageModeProvider({ mode, children }: { mode: StorageMode; children: ReactNode }) {
  return <Ctx.Provider value={mode}>{children}</Ctx.Provider>;
}

export function useStorageMode(): StorageMode {
  return useContext(Ctx);
}

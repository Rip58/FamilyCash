"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { type ReportModule, hiddenModulesParam } from "@/lib/report-modules";

interface Value {
  /** Módulos que esta vez no salen. */
  hidden: ReportModule[];
  setHidden: (next: ReportModule[]) => void;
}

const Ctx = createContext<Value | null>(null);

/**
 * Qué módulos salen en el informe de la noche, en el cliente: cambiar una casilla es instantáneo (sin recargar la
 * página, así que ninguna hoja se cierra). Se refleja en la dirección (`?sin=…`) para que al recargar siga igual.
 */
export function ReportModulesProvider({ initial, children }: { initial: ReportModule[]; children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(initial);
  const setHidden = useCallback((next: ReportModule[]) => {
    setHiddenState(next);
    try {
      const url = new URL(window.location.href);
      const value = hiddenModulesParam(next);
      if (value) url.searchParams.set("sin", value);
      else url.searchParams.delete("sin");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* la dirección es solo un extra */
    }
  }, []);
  const value = useMemo(() => ({ hidden, setHidden }), [hidden, setHidden]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** null fuera de la página de Informe (p. ej. el compañero en /turno, que comparte siempre todo). */
export function useReportModules(): Value | null {
  return useContext(Ctx);
}

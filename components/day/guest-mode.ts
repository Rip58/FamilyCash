"use client";

import { createContext, useContext } from "react";

/** Hoy abierto con el enlace del compañero: sin enlaces a otras pantallas ni notas de otras noches. */
export const GuestModeContext = createContext(false);

export const useGuestMode = () => useContext(GuestModeContext);

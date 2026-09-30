"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { changePassword } from "@/app/actions/settings";
import { logout } from "@/app/actions/auth";
import { BackHeader, Field, PrimaryButton, inputClass, useRun } from "./kit";

export function SecurityForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const { pending, run } = useRun();

  return (
    <div>
      <BackHeader title="Seguridad" />
      <div className="flex flex-col gap-4">
        <Card title="Cambiar contraseña">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => changePassword({ current, next, repeat }), {
                msg: "Contraseña cambiada",
                onDone: () => {
                  setCurrent("");
                  setNext("");
                  setRepeat("");
                },
              });
            }}
          >
            <Field label="Contraseña actual">
              <input type="password" autoComplete="current-password" aria-label="Contraseña actual" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Nueva contraseña" hint="Mínimo 6 caracteres.">
              <input type="password" autoComplete="new-password" aria-label="Nueva contraseña" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Repite la nueva contraseña">
              <input type="password" autoComplete="new-password" aria-label="Repite la nueva contraseña" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputClass} />
            </Field>
            <PrimaryButton
              type="submit"
              className="mt-2 w-full"
              disabled={pending || !current || !next || !repeat}
            >
              Cambiar contraseña
            </PrimaryButton>
          </form>
        </Card>
        <form action={logout}>
          <button
            type="submit"
            className="min-h-11 w-full rounded-card bg-surface text-[17px] font-medium text-danger"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

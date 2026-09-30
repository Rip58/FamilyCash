"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TimeInput } from "@/components/ui/TimeInput";
import { saveShift } from "@/app/actions/settings";
import { isTime } from "@/lib/settings-logic";
import { BackHeader, Field, Stepper, useRun } from "./kit";

export interface ShiftValues {
  shiftStart: string;
  shiftEnd: string;
  breakStart: string;
  breakEnd: string;
  dayRolloverHour: number;
  daysOffPerWeek: number;
}

export function ShiftForm({ initial }: { initial: ShiftValues }) {
  const [v, setV] = useState(initial);
  const { run } = useRun();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(v);

  function update(patch: Partial<ShiftValues>) {
    const next = { ...v, ...patch };
    setV(next);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    const valid = [next.shiftStart, next.shiftEnd, next.breakStart, next.breakEnd].every(isTime);
    if (!valid) return;
    // Guardado inmediato (con una pequeña espera mientras giras la rueda de hora).
    timer.current = setTimeout(() => run(() => saveShift(latest.current)), 500);
  }

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <div>
      <BackHeader title="Turno" />
      <div className="flex flex-col gap-4">
        <Card title="Horario">
          <div className="grid grid-cols-2 gap-3">
            <TimeInput label="Inicio del turno" value={v.shiftStart} onChange={(x) => update({ shiftStart: x })} />
            <TimeInput label="Fin del turno" value={v.shiftEnd} onChange={(x) => update({ shiftEnd: x })} />
            <TimeInput label="Inicio del descanso" value={v.breakStart} onChange={(x) => update({ breakStart: x })} />
            <TimeInput label="Fin del descanso" value={v.breakEnd} onChange={(x) => update({ breakEnd: x })} />
          </div>
        </Card>
        <Card title="Reglas">
          <Field label="Hora de corte de “Hoy”" hint="Antes de esta hora, “Hoy” muestra la noche anterior.">
            <div className="flex items-center gap-3">
              <Stepper label="Hora de corte" value={v.dayRolloverHour} min={0} max={23} onChange={(x) => update({ dayRolloverHour: x })} />
              <span className="text-[15px] text-muted">:00 h</span>
            </div>
          </Field>
          <Field label="Días libres por semana" hint="Se avisa en Semana si un empleado tiene otro número.">
            <Stepper label="Días libres por semana" value={v.daysOffPerWeek} min={0} max={7} onChange={(x) => update({ daysOffPerWeek: x })} />
          </Field>
        </Card>
      </div>
    </div>
  );
}

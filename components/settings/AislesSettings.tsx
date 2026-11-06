"use client";

import { useState } from "react";
import { saveAislesEnabled } from "@/app/actions/settings";
import { Card } from "@/components/ui/Card";
import { BackHeader, Toggle, useRun } from "./kit";

export function AislesSettings({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const { pending, run } = useRun();
  return <div>
    <BackHeader title="Control de pasillos" />
    <Card>
      <Toggle label="Control de pasillos" checked={on} disabled={pending} onChange={(value) => {
        run(() => saveAislesEnabled(value), { msg: value ? "Control activado" : "Control apagado", onDone: () => setOn(value) });
      }} />
      <p className="text-[14px] text-muted">Hoy → ⋯ → Control de pasillos y la tabla de Pasillos del informe. Al apagarlo no se borra lo apuntado.</p>
    </Card>
  </div>;
}

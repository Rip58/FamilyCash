"use client";

import Link from "next/link";
import { saveAiProvider } from "@/app/actions/settings";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import type { AiProvider } from "@/lib/ai-import-format";
import { BackHeader, useRun, useSynced } from "./kit";

interface ProviderInfo {
  id: AiProvider;
  label: string;
  envVar: string;
  configured: boolean;
  model: string;
  free?: boolean;
}

/** Ajustes → Importar con IA: qué IA lee las imágenes del cuadrante y si su clave está puesta en Vercel. */
export function AiSettings({ current, providers }: { current: AiProvider; providers: ProviderInfo[] }) {
  const [value, setValue] = useSynced(current);
  const { pending, run } = useRun();
  return (
    <div>
      <BackHeader title="Importar con IA" />
      <p className="mb-3 px-1 text-[14px] text-muted">
        Lee una foto o captura del cuadrante (Excel) y la carga en el planning de la Semana. Antes de guardar
        siempre verás una vista previa para corregirla.
      </p>
      <Card title="IA que lee las imágenes">
        <div role="radiogroup" aria-label="IA" className="flex flex-col gap-2">
          {providers.map((p) => {
            const selected = value === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => {
                  setValue(p.id);
                  run(() => saveAiProvider(p.id), { msg: `${p.label} seleccionada` });
                }}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-control border-2 px-3 text-left",
                  selected ? "border-accent bg-accent/10" : "border-line",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-accent bg-accent" : "border-line",
                  )}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{p.label}</span>
                  <span className="block text-[13px] text-muted">
                    Modelo: {p.model}
                    {p.free && <span className="font-semibold text-success"> · Gratis</span>}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold",
                    p.configured ? "bg-success/15 text-success" : "bg-warning/20 text-warning",
                  )}
                >
                  {p.configured ? "✓ Clave puesta" : "Falta la clave"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="Cómo poner la clave" className="mt-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-[14px]">
          <li>
            En vercel.com → proyecto → <b>Settings → Environment Variables</b>, añade{" "}
            {providers.map((p, i) => (
              <span key={p.id}>
                {i > 0 && " o "}
                <code className="rounded bg-surface-2 px-1">{p.envVar}</code>
              </span>
            ))}{" "}
            con tu clave (Production y Preview).
          </li>
          <li>
            Vuelve a publicar (<b>Deployments → ⋯ → Redeploy</b>) para que la app la vea.
          </li>
          <li>
            Para usarla: <b>Semana → ⋯ → Cargar desde imagen (IA)</b>.
          </li>
        </ol>
        <p className="mt-2 text-[13px] text-muted">
          La clave solo la usa el servidor; nunca llega al móvil. Con Claude o ChatGPT cada lectura de una imagen cuesta
          unos céntimos en tu cuenta de la IA.
        </p>
        <p className="mt-2 text-[13px] text-muted">
          <b className="text-fg">Gemini</b>: la clave se saca gratis en{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-semibold text-accent">
            aistudio.google.com/apikey
          </a>{" "}
          (variable <code className="rounded bg-surface-2 px-1">GEMINI_API_KEY</code>). Gratis con límite diario, de sobra
          para un par de imágenes por semana. Ojo: en el plan gratuito Google puede revisar y usar las imágenes (con los
          nombres de la plantilla) para mejorar sus productos.
        </p>
      </Card>
      <Link
        href="/semana/importar"
        className="mt-4 flex min-h-12 items-center justify-center rounded-card bg-accent text-[16px] font-semibold text-accent-fg"
      >
        Cargar una semana desde imagen
      </Link>
    </div>
  );
}

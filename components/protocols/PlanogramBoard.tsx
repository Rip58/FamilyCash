"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPlanogram, deletePlanogram, updatePlanogram } from "@/app/actions/planograms";
import { PhotoPicker, usePhotoUploads } from "@/components/reports/PhotoPicker";
import { PhotoViewer } from "@/components/reports/PhotoViewer";
import { ConfirmButton, PrimaryButton, inputClass, notify, useRun } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { type DateStr, formatDayMonth } from "@/lib/dates";
import {
  type LocationOption,
  MAX_PLANOGRAM_TEXT,
  type PlanogramView,
  untilLabel,
  untilState,
} from "@/lib/planogram-format";
import { ProtocolTabs } from "./ProtocolTabs";

const NONE = "Sin ubicación";

interface Group {
  key: string;
  name: string;
  items: PlanogramView[];
}

/** Agrupa por ubicación en el orden de Ajustes; "Sin ubicación" al final. */
function groupByLocation(items: PlanogramView[], locations: LocationOption[]): Group[] {
  const groups: Group[] = locations.map((l) => ({ key: l.id, name: l.name, items: [] }));
  const none: Group = { key: "none", name: NONE, items: [] };
  for (const it of items) (groups.find((g) => g.key === it.locationId) ?? none).items.push(it);
  return [...groups, none].filter((g) => g.items.length > 0);
}

export function PlanogramBoard({
  planograms,
  locations,
  today,
}: {
  planograms: PlanogramView[];
  locations: LocationOption[];
  today: DateStr;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlanogramView | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const current = planograms.filter((p) => untilState(p.until, today) !== "expired");
  const expired = planograms.filter((p) => untilState(p.until, today) === "expired");
  const groups = groupByLocation(current, locations);
  const activeLocations = locations.filter((l) => l.active);

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between gap-3 pt-4">
        <h1 className="text-[28px] font-bold tracking-tight">Protocolos</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 text-[15px] font-semibold text-accent-fg"
        >
          + Lineal
        </button>
      </div>
      <ProtocolTabs active="lineales" />

      {activeLocations.length === 0 && (
        <p className="mt-3 rounded-card bg-surface px-4 py-3 text-[14px] text-muted">
          Añade las ubicaciones (lineal PA, box…) en{" "}
          <Link href="/ajustes/ubicaciones" className="font-medium text-accent">
            Ajustes → Ubicaciones
          </Link>{" "}
          para poder elegirlas.
        </p>
      )}

      {planograms.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center">
          <span className="text-[40px]" aria-hidden>
            🧃
          </span>
          <p className="text-[17px] font-semibold">Aún no hay lineales</p>
          <p className="text-muted">Sube la foto de cómo tiene que quedar un lineal, con una nota y hasta cuándo.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1 inline-flex min-h-11 items-center rounded-control bg-accent px-5 text-[16px] font-semibold text-accent-fg"
          >
            + Añadir lineal
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.name}>
              <h2 className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">{g.name}</h2>
              <ul className="flex flex-col gap-3">
                {g.items.map((p) => (
                  <PlanogramCard key={p.id} item={p} today={today} onEdit={() => setEditing(p)} />
                ))}
              </ul>
            </section>
          ))}
          {current.length === 0 && <p className="text-center text-muted">No hay lineales vigentes.</p>}
          {expired.length > 0 && (
            <section aria-label="Caducados">
              <button
                type="button"
                aria-expanded={showExpired}
                onClick={() => setShowExpired((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between rounded-card bg-surface px-4 text-[16px] font-medium"
              >
                <span>Caducados ({expired.length})</span>
                <span aria-hidden className="text-muted">
                  {showExpired ? "▾" : "▸"}
                </span>
              </button>
              {showExpired && (
                <ul className="mt-3 flex flex-col gap-3 opacity-80">
                  {expired.map((p) => (
                    <PlanogramCard key={p.id} item={p} today={today} onEdit={() => setEditing(p)} showLocation />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <NewPlanogram open={creating} onClose={() => setCreating(false)} locations={activeLocations} />
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title="Editar lineal">
        {editing && (
          <EditPlanogram
            key={editing.id}
            item={editing}
            locations={locations.filter((l) => l.active || l.id === editing.locationId)}
            onClose={() => setEditing(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function UntilTag({ until, today }: { until: DateStr | null; today: DateStr }) {
  const state = untilState(until, today);
  const label = untilLabel(until, today);
  if (!label) return <span className="text-[13px] text-muted">Sin fecha de fin</span>;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[13px] font-semibold",
        state === "expired" && "bg-danger/15 text-danger",
        state === "soon" && "bg-warning/20 text-warning",
        state === "ok" && "bg-success/15 text-success",
      )}
    >
      {label}
    </span>
  );
}

function PlanogramCard({
  item,
  today,
  onEdit,
  showLocation,
}: {
  item: PlanogramView;
  today: DateStr;
  onEdit: () => void;
  showLocation?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [first, ...rest] = item.photos;
  const caption = [item.locationName, item.text].filter(Boolean).join(" · ");
  return (
    <li className="overflow-hidden rounded-card bg-surface">
      {first && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          aria-label={`Ampliar foto de ${item.locationName ?? "lineal"}`}
          className="block w-full bg-surface-2 active:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.url} alt="" loading="lazy" width={first.width} height={first.height} className="h-auto w-full" />
        </button>
      )}
      <div className="p-3">
        {rest.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Más fotos">
            {rest.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpen(i + 1)}
                  aria-label={`Abrir foto ${i + 2} de ${item.photos.length}`}
                  className="block h-[64px] w-[64px] overflow-hidden rounded-control bg-surface-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {showLocation && <p className="text-[13px] font-semibold text-muted">{item.locationName ?? NONE}</p>}
        {item.text && <p className="whitespace-pre-wrap text-[16px] leading-snug">{item.text}</p>}
        <div className="mt-2 flex items-center gap-2">
          <UntilTag until={item.until} today={today} />
          <span className="flex-1 text-right text-[12px] text-muted">desde {formatDayMonth(item.createdDate)}</span>
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 rounded-control bg-surface-2 px-4 text-[15px] font-medium text-accent"
          >
            Editar
          </button>
        </div>
      </div>
      <PhotoViewer photos={item.photos} index={open} caption={caption || undefined} onClose={() => setOpen(null)} />
    </li>
  );
}

function LocationSelect({
  value,
  onChange,
  locations,
}: {
  value: string;
  onChange: (v: string) => void;
  locations: LocationOption[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted">Ubicación</span>
      <select aria-label="Ubicación" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">{NONE}</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function UntilInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted">Hasta (opcional)</span>
      <div className="flex gap-2">
        <input
          type="date"
          aria-label="Hasta"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, "flex-1")}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="min-h-11 rounded-control bg-surface-2 px-3 text-[15px] font-medium text-accent"
          >
            Sin fecha
          </button>
        )}
      </div>
    </label>
  );
}

function NewPlanogram({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: LocationOption[] }) {
  const uploads = usePhotoUploads();
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reinicia el formulario cada vez que se abre.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLocation("");
      setText("");
      setUntil("");
      setError(null);
    }
  }

  function close() {
    uploads.discard(); // descarta lo subido que no se llegó a guardar
    onClose();
  }

  const { uploading, failed } = uploads;
  const hasPhoto = uploads.results.length > 0;
  const canSend = hasPhoto && !uploading && !failed && !pending;

  function send() {
    setError(null);
    start(async () => {
      try {
        const r = await createPlanogram({ locationId: location || null, text, until: until || null, photos: uploads.results });
        if (r.ok) {
          notify("Lineal guardado");
          uploads.clearSent();
          onClose();
        } else setError(r.error);
      } catch {
        setError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.");
      }
    });
  }

  const hint = uploading
    ? "Subiendo fotos…"
    : failed
      ? "Reintenta o quita las fotos que han fallado."
      : !hasPhoto
        ? "Añade la foto de cómo tiene que quedar."
        : null;

  return (
    <BottomSheet open={open} onClose={close} title="Nuevo lineal">
      <div className="flex flex-col gap-4 pb-2">
        {(error ?? uploads.error) && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
            {error ?? uploads.error}
          </p>
        )}
        <LocationSelect value={location} onChange={setLocation} locations={locations} />
        <PhotoPicker uploads={uploads} noun="lineal" />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">Nota</span>
          <textarea
            value={text}
            rows={3}
            maxLength={MAX_PLANOGRAM_TEXT}
            placeholder="Ej.: promoción de verano, dejarlo siempre así…"
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} py-2`}
          />
        </label>
        <UntilInput value={until} onChange={setUntil} />
        <div className="flex flex-col gap-1.5">
          <PrimaryButton onClick={send} disabled={!canSend}>
            {pending ? "Guardando…" : "Guardar lineal"}
          </PrimaryButton>
          {hint && (
            <p className="text-center text-[13px] text-muted" aria-live="polite">
              {hint}
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function EditPlanogram({
  item,
  locations,
  onClose,
}: {
  item: PlanogramView;
  locations: LocationOption[];
  onClose: () => void;
}) {
  const [location, setLocation] = useState(item.locationId ?? "");
  const [text, setText] = useState(item.text);
  const [until, setUntil] = useState(item.until ?? "");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-col gap-4 pb-2">
      <LocationSelect value={location} onChange={setLocation} locations={locations} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">Nota</span>
        <textarea
          value={text}
          rows={3}
          maxLength={MAX_PLANOGRAM_TEXT}
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} py-2`}
        />
      </label>
      <UntilInput value={until} onChange={setUntil} />
      <PrimaryButton
        disabled={pending}
        onClick={() =>
          run(() => updatePlanogram({ id: item.id, locationId: location || null, text, until: until || null }), {
            msg: "Lineal guardado",
            onDone: onClose,
          })
        }
      >
        Guardar cambios
      </PrimaryButton>
      <p className="text-[13px] text-muted">¿Ha cambiado el lineal? Bórralo y sube uno nuevo con la foto actual.</p>
      <ConfirmButton
        label="Borrar lineal"
        confirmLabel="Sí, borrar lineal y fotos"
        onConfirm={() => run(() => deletePlanogram(item.id), { msg: "Lineal borrado", onDone: onClose })}
      />
    </div>
  );
}

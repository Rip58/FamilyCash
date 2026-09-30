"use client";

import { useCallback, useEffect, useState } from "react";
import { CLIENT_BUILD_TIME, CLIENT_VERSION, compareVersions, formatBuildTime, type VersionStatus } from "@/lib/version";

interface ServerVersion {
  version: string;
  builtAt: string | null;
}

/** Borra service workers y cachés y recarga desde la red. */
async function forceUpdate() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.location.replace(url.toString());
  }
}

async function fetchServerVersion(): Promise<ServerVersion | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ServerVersion;
  } catch {
    return null;
  }
}

export function VersionCard() {
  const [server, setServer] = useState<ServerVersion | null>(null);
  const [status, setStatus] = useState<VersionStatus | "checking">("checking");
  const [updating, setUpdating] = useState(false);

  const apply = useCallback((data: ServerVersion | null) => {
    setServer(data);
    setStatus(data ? compareVersions(CLIENT_VERSION, data.version) : "unknown");
  }, []);

  const check = () => {
    setStatus("checking");
    void fetchServerVersion().then(apply);
  };

  useEffect(() => {
    // Limpia el ?v= que deja "Forzar actualización".
    const url = new URL(window.location.href);
    if (url.searchParams.has("v")) {
      url.searchParams.delete("v");
      window.history.replaceState(null, "", url.toString());
    }
    void fetchServerVersion().then(apply);
  }, [apply]);

  const statusView = {
    checking: { text: "Comprobando…", cls: "text-muted" },
    same: { text: "✓ Estás en la última versión", cls: "text-success" },
    outdated: { text: "Hay una versión nueva", cls: "text-warning" },
    unknown: { text: "No se pudo comprobar (¿sin conexión?)", cls: "text-muted" },
  }[status];

  return (
    <section aria-label="Versión de la app" className="overflow-hidden rounded-card bg-surface">
      <div className="flex flex-col gap-1 px-4 pb-2 pt-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Versión</h2>
        <p className="flex justify-between gap-3 text-[15px]">
          <span className="text-muted">En este móvil</span>
          <span className="tabular-nums">
            {CLIENT_VERSION} · {formatBuildTime(CLIENT_BUILD_TIME)}
          </span>
        </p>
        <p className="flex justify-between gap-3 text-[15px]">
          <span className="text-muted">Publicada</span>
          <span className="tabular-nums">
            {server ? `${server.version} · ${formatBuildTime(server.builtAt)}` : "—"}
          </span>
        </p>
        <p role="status" className={`pt-1 text-[15px] font-semibold ${statusView.cls}`}>
          {statusView.text}
        </p>
      </div>
      <div className="flex border-t border-line">
        <button
          type="button"
          onClick={check}
          disabled={status === "checking"}
          className="min-h-12 flex-1 border-r border-line text-[16px] text-accent disabled:opacity-50"
        >
          Comprobar
        </button>
        <button
          type="button"
          onClick={() => {
            setUpdating(true);
            void forceUpdate();
          }}
          disabled={updating}
          className={`min-h-12 flex-1 text-[16px] font-semibold disabled:opacity-50 ${
            status === "outdated" ? "bg-accent text-accent-fg" : "text-accent"
          }`}
        >
          {updating ? "Actualizando…" : "Forzar actualización"}
        </button>
      </div>
    </section>
  );
}

import { TIME_ZONE } from "@/lib/dates";

/** Versión incrustada en el bundle del cliente al compilar. */
export const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
export const CLIENT_BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? null;

export type VersionStatus = "same" | "outdated" | "unknown";

export function compareVersions(client: string, server: string | null | undefined): VersionStatus {
  if (!server) return "unknown";
  return client === server ? "same" : "outdated";
}

/** "30 sep, 14:20" en hora de Madrid. */
export function formatBuildTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(".", "");
}

import { headers } from "next/headers";
import { GuestLinkForm } from "@/components/settings/GuestLinkForm";
import { madridTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { GUEST_MAX_FAILS } from "@/lib/guest";

export const metadata = { title: "Acceso del compañero" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [s, h] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 }, select: { guestToken: true, guestPinHash: true, guestFails: true, guestLockedUntil: true } }),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const on = !!(s?.guestToken && s.guestPinHash);
  const locked = s?.guestLockedUntil && s.guestLockedUntil > new Date() ? madridTime(s.guestLockedUntil) : null;
  return (
    <GuestLinkForm
      url={`${proto}://${host}/turno`}
      on={on}
      fails={s?.guestFails ?? 0}
      lockedUntil={locked}
      autoDisabled={!on && (s?.guestFails ?? 0) >= GUEST_MAX_FAILS}
    />
  );
}

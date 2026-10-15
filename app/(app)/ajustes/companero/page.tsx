import { headers } from "next/headers";
import { GuestLinkForm } from "@/components/settings/GuestLinkForm";
import { currentGuestToken } from "@/lib/guest-server";

export const metadata = { title: "Enlace del compañero" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [token, h] = await Promise.all([currentGuestToken(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <GuestLinkForm origin={`${proto}://${host}`} token={token} />;
}

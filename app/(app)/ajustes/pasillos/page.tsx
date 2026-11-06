import { AislesSettings } from "@/components/settings/AislesSettings";
import { getSettings } from "@/lib/queries";

export const metadata = { title: "Control de pasillos" };
export default async function Page() {
  const settings = await getSettings();
  return <AislesSettings enabled={settings.aislesEnabled} />;
}

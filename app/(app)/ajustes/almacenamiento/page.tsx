import { StorageSettings } from "@/components/settings/StorageSettings";
import { storageStats } from "@/lib/report-queries";
import { storageMode } from "@/lib/storage";

export const metadata = { title: "Almacenamiento" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const stats = await storageStats();
  return <StorageSettings {...stats} mode={storageMode()} />;
}

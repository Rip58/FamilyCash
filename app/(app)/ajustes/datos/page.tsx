import { DataExport } from "@/components/settings/DataExport";
import { StorageSettings } from "@/components/settings/StorageSettings";
import { operationalToday } from "@/lib/dates";
import { storageStats } from "@/lib/note-queries";
import { getSettings } from "@/lib/queries";
import { blobMissing, storageMode } from "@/lib/storage";

export const metadata = { title: "Datos y fotos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ dayRolloverHour }, stats] = await Promise.all([getSettings(), storageStats()]);
  return (
    <>
      <DataExport today={operationalToday(new Date(), dayRolloverHour)} />
      <StorageSettings {...stats} mode={storageMode()} blobMissing={blobMissing()} />
    </>
  );
}

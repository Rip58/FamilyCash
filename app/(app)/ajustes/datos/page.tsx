import { DataExport } from "@/components/settings/DataExport";
import { StorageSettings } from "@/components/settings/StorageSettings";
import { madridToday, operationalToday } from "@/lib/dates";
import { listBackups } from "@/lib/backup-store";
import { storageStats } from "@/lib/note-queries";
import { getSettings } from "@/lib/queries";
import { blobMissing, storageMode } from "@/lib/storage";

export const metadata = { title: "Datos y fotos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ dayRolloverHour }, stats, backups] = await Promise.all([
    getSettings(),
    storageStats(),
    listBackups().catch(() => []),
  ]);
  return (
    <>
      <DataExport today={operationalToday(new Date(), dayRolloverHour)} backupToday={madridToday()} backups={backups} blobMissing={blobMissing()} />
      <StorageSettings {...stats} mode={storageMode()} blobMissing={blobMissing()} />
    </>
  );
}

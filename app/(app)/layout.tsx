import { StorageModeProvider } from "@/components/reports/StorageContext";
import { Toaster } from "@/components/settings/kit";
import { TabBar } from "@/components/ui/TabBar";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageModeProvider mode={storageMode()}>
      <main className="app-main mx-auto w-full max-w-xl px-4">{children}</main>
      <TabBar />
      <Toaster />
    </StorageModeProvider>
  );
}

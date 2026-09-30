import { StorageModeProvider } from "@/components/reports/StorageContext";
import { Toaster } from "@/components/settings/kit";
import { TabBar } from "@/components/ui/TabBar";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageModeProvider mode={storageMode()}>
      {/* Tapa la zona de la barra de estado (modo standalone) para que el contenido no se vea debajo. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 bg-bg" style={{ height: "env(safe-area-inset-top)" }} />
      <main className="app-main mx-auto w-full max-w-xl px-4">{children}</main>
      <TabBar />
      <Toaster />
    </StorageModeProvider>
  );
}

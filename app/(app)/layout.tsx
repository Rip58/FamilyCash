import { StorageModeProvider } from "@/components/reports/StorageContext";
import { Toaster } from "@/components/ui/toast";
import { UpdateBanner } from "@/components/pwa/UpdateBanner";
import { TabBar } from "@/components/ui/TabBar";
import { ScrollMemory } from "@/components/pwa/ScrollMemory";
import { Suspense } from "react";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageModeProvider mode={storageMode()}>
      {/* Tapa la zona de la barra de estado (modo standalone) para que el contenido no se vea debajo. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 bg-bg" style={{ height: "env(safe-area-inset-top)" }} />
      {/* El scroll vive aquí y no en el documento: en iOS 26.0 (WebKit 297779), tras cerrar el teclado o la hoja de
          compartir, la barra fija se quedaba a media pantalla y «flotaba» al hacer scroll. La barra queda fuera. */}
      <div id="app-scroll" className="app-scroll">
        <main className="app-main mx-auto w-full max-w-xl px-4">{children}</main>
      </div>
      <Suspense>
        <ScrollMemory />
      </Suspense>
      <TabBar />
      <UpdateBanner />
      <Toaster />
    </StorageModeProvider>
  );
}

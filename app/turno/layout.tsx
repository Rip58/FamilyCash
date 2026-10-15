import { StorageModeProvider } from "@/components/reports/StorageContext";
import { Toaster } from "@/components/ui/toast";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Página del compañero (enlace sin contraseña): solo Hoy de la noche en curso, sin pestañas. */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageModeProvider mode={storageMode()}>
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 bg-bg" style={{ height: "env(safe-area-inset-top)" }} />
      <div id="app-scroll" className="app-scroll">
        <main className="app-main mx-auto w-full max-w-xl px-4">{children}</main>
      </div>
      <Toaster />
    </StorageModeProvider>
  );
}

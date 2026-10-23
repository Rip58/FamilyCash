import { Toaster } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

/** Página de vacaciones de los empleados (con su PIN personal): sin pestañas ni nada más de la app. */
export default function VacationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 bg-bg" style={{ height: "env(safe-area-inset-top)" }} />
      <div id="app-scroll" className="app-scroll">
        <main className="app-main mx-auto w-full max-w-xl px-4">{children}</main>
      </div>
      <Toaster />
    </>
  );
}

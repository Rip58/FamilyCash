import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NoPageZoom } from "@/components/pwa/NoPageZoom";
import { RegisterSW } from "@/components/pwa/RegisterSW";

export const metadata: Metadata = {
  title: { default: "Plantilla Noche", template: "%s · Plantilla Noche" },
  description: "Control de la plantilla del turno de noche.",
  applicationName: "Plantilla Noche",
  appleWebApp: { capable: true, title: "Plantilla", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Safari en iOS (anterior a 17.4) solo reconoce la variante con prefijo apple-.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // App solo para el móvil: sin zoom de página (iOS ampliaba al tocar campos y luego la pantalla y el menú
  // se movían al hacer scroll). Las fotos tienen su propio zoom en el visor.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <RegisterSW />
        <NoPageZoom />
      </body>
    </html>
  );
}

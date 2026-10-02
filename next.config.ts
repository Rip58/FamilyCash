import type { NextConfig } from "next";

// Versión de este build: se incrusta en el cliente y la sirve /api/version para compararlas.
const APP_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
const BUILD_TIME = new Date().toISOString();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION, NEXT_PUBLIC_BUILD_TIME: BUILD_TIME },
  serverExternalPackages: ["pg"],
  // Las pestañas se precargan completas (TabBar, prefetch={true}) y se reutilizan 5 min: cambiar de pestaña
  // es instantáneo. Guardar algo (revalidatePath/updateTag) invalida esta caché, y al volver a la app tras
  // más de 2 min se refresca (TabBar), así que no se quedan datos viejos.
  experimental: { staleTimes: { dynamic: 300, static: 300 } },
  async headers() {
    return [
      // El service worker debe revalidarse siempre para que las actualizaciones lleguen.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;

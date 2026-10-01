import type { NextConfig } from "next";

// Versión de este build: se incrusta en el cliente y la sirve /api/version para compararlas.
const APP_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
const BUILD_TIME = new Date().toISOString();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION, NEXT_PUBLIC_BUILD_TIME: BUILD_TIME },
  serverExternalPackages: ["pg"],
  // Volver a una pestaña ya vista en los últimos 30 s es instantáneo (caché del router en el cliente).
  // Las mutaciones (revalidatePath/updateTag) invalidan esta caché, así que no se ven datos viejos tras guardar.
  experimental: { staleTimes: { dynamic: 30 } },
  async headers() {
    return [
      // El service worker debe revalidarse siempre para que las actualizaciones lleguen.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;

/* Service worker mínimo de Plantilla Noche.
 *
 * - Cachea solo el "shell" estático: /offline.html, los iconos y los assets inmutables de /_next/static.
 * - Navegación: red primero; si no hay red, muestra /offline.html. El HTML NUNCA se guarda en caché
 *   (es autenticado y con datos del turno: no debe enseñarse viejo).
 * - No intercepta /api, POST (server actions), peticiones RSC ni nada que no sea lo anterior.
 * - Navigation preload: la petición de la página sale en paralelo al arranque del service worker.
 */
const VERSION = "v2";
const SHELL_CACHE = `plantilla-shell-${VERSION}`;
const STATIC_CACHE = `plantilla-static-${VERSION}`;
const SHELL_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/apple-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.all(SHELL_URLS.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("plantilla-") && k !== SHELL_CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.registration.navigationPreload?.enable())
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      Promise.resolve(event.preloadResponse)
        .then((pre) => pre || fetch(req))
        .catch(() => caches.match("/offline.html").then((r) => r || new Response("Sin conexión", { status: 503 }))),
    );
    return;
  }

  // Assets con hash (inmutables): caché primero.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  // Iconos del shell: caché primero, actualiza en segundo plano.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

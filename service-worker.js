const CACHE = "zaagerij-v10";
const ASSETS = ["./","./index.html","./app.js","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png","./icon-512-maskable.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// De app zelf (pagina + app.js) eerst van het netwerk halen, zodat een nieuwe versie
// meteen binnenkomt in plaats van blijven hangen op een oude cache. Lukt dat niet
// (offline), dan alsnog uit de cache. Iconen en manifest blijven cache-first.
const isApp = (req) => req.mode === "navigate" || /\/(index\.html|app\.js)$/.test(new URL(req.url).pathname);
const cachePut = (req, resp) => { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); return resp; };
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  if (isApp(req)) { e.respondWith(fetch(req).then((resp) => cachePut(req, resp)).catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))); return; }
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => cachePut(req, resp)).catch(() => caches.match("./index.html"))));
});

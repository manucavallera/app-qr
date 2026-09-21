const CACHE = "app-qr-static-v1";
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/offline"]))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => { const request = event.request; const url = new URL(request.url); if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/staff") || url.pathname.startsWith("/m/")) return; event.respondWith(fetch(request).catch(() => caches.match("/offline"))); });

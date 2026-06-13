'use strict';
/* FRONTLINE service worker — offline-first app-shell caching.
   Cache-first so the terminal works flawlessly in regional black spots. */

const VERSION = 'civitas-frontline-v2';
const ASSETS = [
  './',
  './index.html',
  './css/frontline.css',
  './js/frontline.js',
  './js/crypto.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(cache =>
      // add individually: one missing icon must not break the whole shell
      Promise.allSettled(ASSETS.map(a => cache.add(a)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => {
          if (e.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504 });
        });
    })
  );
});

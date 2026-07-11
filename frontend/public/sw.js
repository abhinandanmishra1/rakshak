// Simple Service Worker for PWA installability
const CACHE_NAME = 'rakshak-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // basic pass-through for network requests
  event.respondWith(fetch(event.request));
});

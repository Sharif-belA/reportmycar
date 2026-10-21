// Service Worker for Car Owner App (PWA) with Background Web Push Support
const CACHE_NAME = 'car-alert-unified-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  '../firebase-keys.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (
    e.request.url.includes('firebase') ||
    e.request.url.includes('firestore') ||
    e.request.url.includes('googleapis') ||
    e.request.url.includes('gstatic')
  ) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});

// ============================================================================
// إشعارات الخلفية والتطبيق مغلق تماماً (Background Web Push Event)
// ============================================================================
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    try {
      payload = { data: { body: event.data.text() } };
    } catch (e) {}
  }

  const info = payload.data || payload.notification || {};
  const title = info.title || '🚨 تنبيه جديد بخصوص سيارتك!';
  const body = info.body || 'وصلك بلاغ جديد من الشارع، اضغط لعرض التفاصيل';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: info.reportId || 'car-alert-bg-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      data: { url: info.url || './index.html' }
    })
  );
});

// Click on Notification -> Focus or Open Window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

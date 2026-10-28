/*
 * Service worker Star Command: app tetap bisa dibuka tanpa internet.
 * - Halaman: network-first, salinan terakhir disimpan; offline = pakai salinan.
 * - Aset build (_next/static) dan font: cache-first (nama file sudah berhash).
 * - POST (server action), /api, /export, /login: tidak pernah di-cache.
 * Perubahan saat offline disimpan di perangkat oleh app (outbox) dan dikirim
 * ulang saat online, bukan oleh service worker.
 */
const VERSION = 'v1';
const PAGES = `sc-pages-${VERSION}`;
const STATIC = `sc-static-${VERSION}`;
const WARM = ['/', '/tasks', '/habits', '/notes', '/training', '/settings'];
const SKIP = [/^\/api\//, /^\/export/, /^\/login/, /^\/auth/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.add('/offline.html'))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

/** Simpan halaman utama di belakang layar, supaya offline pertama kali pun ada isinya. */
async function warm() {
  const cache = await caches.open(PAGES);
  for (const path of WARM) {
    try {
      const res = await fetch(path, { credentials: 'same-origin' });
      if (res.ok && !res.redirected) await cache.put(path, res);
    } catch {
      /* offline atau belum login: lewati */
    }
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'warm') event.waitUntil(warm());
  if (event.data === 'clear') event.waitUntil(caches.delete(PAGES));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(cacheFirst(req));
    return;
  }
  if (SKIP.some((re) => re.test(url.pathname))) return;
  if (url.pathname.startsWith('/_next/static/') || /\.(?:svg|png|jpg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Navigasi client-side Next (RSC): kalau gagal, Next pindah ke navigasi biasa
  // yang dilayani salinan halaman di bawah.
  if (req.headers.get('RSC') === '1') return;
  if (req.mode === 'navigate') event.respondWith(page(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function page(req) {
  const cache = await caches.open(PAGES);
  const key = new URL(req.url).pathname;
  try {
    const res = await withTimeout(fetch(req), 6000);
    if (res.redirected && new URL(res.url).pathname.startsWith('/login')) {
      // Sesi habis: jangan tinggalkan salinan data lama di perangkat.
      await caches.delete(PAGES);
    } else if (res.ok && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
      await cache.put(key, res.clone());
    }
    return res;
  } catch {
    return (await cache.match(key)) || (await cache.match('/')) || (await caches.match('/offline.html')) || Response.error();
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

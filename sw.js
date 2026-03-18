/**
 * sw.js — Gnoke OBD2
 * Service worker for offline-first PWA support.
 *
 * ── DEPLOY CHECKLIST ───────────────────────────────────────────
 * Bump CACHE_NAME version on every deploy so stale caches clear.
 * Format: gnoke-obd2-v{n}
 *
 * ── STRATEGY ───────────────────────────────────────────────────
 * Install  → pre-cache all known assets (app shell + all plugins)
 * Activate → delete all caches that don't match CACHE_NAME
 * Fetch    → cache-first for pre-cached assets,
 *            network-first for everything else (API calls, etc.)
 */

const CACHE_NAME = 'gnoke-obd2-v1';   /* ← bump on every deploy */

const ASSETS = [

  /* ── App shell ────────────────────────────────────────────── */
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './global.png',

  /* ── Root scripts ─────────────────────────────────────────── */
  './script.js',
  './update.js',

  /* ── Core modules (always required) ──────────────────────── */
  './core/kernel.js',
  './core/pids.js',
  './core/dashboard.js',
  './core/diagnostics.js',

  /* ── Feature apps ─────────────────────────────────────────── */
  './apps/timing.js',
  './apps/emissions.js',
  './apps/battery.js',
  './apps/readiness.js',
  './apps/freezeframe.js',
  './apps/recorder.js',

  /* ── Plugins ──────────────────────────────────────────────── */
  './plugins/vin.js',
  './plugins/engine.js',
  './plugins/monitoring.js',

  /* ── sql.js CDN (WASM engine) ─────────────────────────────── */
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm',

  /* ── Google Fonts (pre-cached so the UI looks right offline) ─ */
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;600&display=swap',
];

/* ── Install: pre-cache all assets ─────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate immediately, don't wait for old SW to die

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      /*
        addAll fails atomically — if any single asset 404s the whole
        install fails. We split out assets that might legitimately be
        absent (optional plugins, fonts) so they don't block install.
      */
      const required = ASSETS.filter(url =>
        !url.includes('googleapis.com') &&
        !url.includes('sql-wasm.wasm')  // wasm fetched by sql-wasm.js itself
      );

      const optional = ASSETS.filter(url =>
        url.includes('googleapis.com') ||
        url.includes('sql-wasm.wasm')
      );

      // Required assets must all succeed
      const requiredPromise = cache.addAll(required);

      // Optional assets: best-effort, failures are silent
      const optionalPromise = Promise.allSettled(
        optional.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Optional asset not cached:', url, err.message)
          )
        )
      );

      return Promise.all([requiredPromise, optionalPromise]);
    })
  );
});

/* ── Activate: evict stale caches ──────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Take control of all open tabs immediately
  );
});

/* ── Fetch: cache-first with network fallback ───────────────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests we haven't explicitly cached
  // (e.g. GitHub API calls for update checker — should always be live)
  const url = new URL(event.request.url);
  const isGitHub = url.hostname.includes('github') ||
                   url.hostname.includes('githubusercontent');
  if (isGitHub) {
    // Network-only for GitHub — update checker must be live
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached; // Serve from cache instantly
      }

      // Not in cache — try network, then cache the response for next time
      return fetch(event.request)
        .then(networkResponse => {
          // Only cache successful same-origin or CORS responses
          if (
            networkResponse.ok &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Completely offline and not in cache
          // Return a minimal offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // For other assets, just fail silently
        });
    })
  );
});

/* ── Message handler: force update from app ─────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const CACHE_NAME = 'scoqx-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/gallery.html',
  '/compilations.html',
  '/commands.html',
  '/styles/style.css',
  '/styles/gallery.css',
  '/styles/compilations.css',
  '/scripts/language.js',
  '/scripts/navigation.js',
  '/scripts/compilations.js',
  '/scripts/gallery.js',
  '/scripts/gallery-advanced.js',
  '/scripts/gallery-auto.js',
  '/scripts/index.js',
  '/assets/blender_180.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request for network fetch
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response for caching
          const responseToCache = response.clone();
          
          // Cache images, CSS, JS, and HTML files
          if (event.request.destination === 'image' || 
              event.request.url.includes('.css') || 
              event.request.url.includes('.js') || 
              event.request.url.includes('.html')) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

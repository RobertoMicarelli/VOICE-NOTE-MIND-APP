const CACHE_NAME = 'ai-utati-voice-notes-v1';
const STATIC_CACHE_NAME = 'ai-utati-static-v1';

// Lista dei file da memorizzare nella cache
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './service-worker.js',
    './icons/logo192.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32x32.png',
    './icons/favicon-16x16.png',
    './icons/icon.svg'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            // Cache per i file statici
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Cache principale
            caches.open(CACHE_NAME).then((cache) => {
                console.log('Caching app shell');
                return cache.addAll(STATIC_ASSETS);
            })
        ])
    );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Gestione delle richieste
self.addEventListener('fetch', (event) => {
    // Gestione delle richieste API (trascrizione)
    if (event.request.url.includes('generativelanguage.googleapis.com')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ error: 'Offline mode not available for API calls' }),
                        {
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }

    // Gestione delle richieste statiche
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone della richiesta
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    (response) => {
                        // Controlla se abbiamo ricevuto una risposta valida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone della risposta
                        const responseToCache = response.clone();

                        // Aggiungi la risposta alla cache
                        caches.open(STATIC_CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});

// Gestione dei messaggi dal client
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}); 
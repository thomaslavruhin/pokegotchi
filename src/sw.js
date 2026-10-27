/* Service worker do Pokégotchi: deixa o jogo instalável e jogável offline.
   O build (tools/build.php) troca o marcador da versão por um hash do index.html, manifest e ícones,
   então cada publicação nova gera um cache novo e apaga o antigo. */
const VERSION = '/*VERSION*/';
const CORE = `pokegotchi-core-${VERSION}`;
const CORE_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
const SCOPE = new URL('./', self.location).pathname;   // ex.: /pokegotchi/

self.addEventListener('install', e => {
  // cache: 'reload' pula o cache HTTP do GitHub Pages (10 min): a versão nova nunca guarda a página velha
  const fresh = CORE_FILES.map(u => new Request(u, { cache: 'reload' }));
  e.waitUntil(caches.open(CORE).then(c => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // apaga versões antigas e o cache de fontes/Tailwind de outros domínios, que o jogo não usa mais
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('pokegotchi-') && k !== CORE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // a página do jogo: rede primeiro (pega a versão nova quando há internet), cache quando offline.
  // Só a raiz e o index.html contam como "o jogo": outras páginas do site não sobrescrevem a cópia offline.
  if (req.mode === 'navigate') {
    const isGame = url.origin === self.location.origin && (url.pathname === SCOPE || url.pathname === SCOPE + 'index.html');
    if (!isGame) return;
    const cached = () => caches.match('./index.html').then(hit => hit || caches.match('./'));
    const net = fetch(req)
      .then(res => {
        if (res.ok && !res.redirected) { const copy = res.clone(); e.waitUntil(caches.open(CORE).then(c => c.put('./index.html', copy))); return res; }
        return caches.match('./index.html').then(hit => hit || res);   // erro do servidor: abre a cópia que já temos
      })
      .catch(cached);
    // rede lenta (conectado, mas travando): em 3,5 s abre a cópia guardada; a resposta da rede ainda atualiza o cache
    const slow = new Promise(r => setTimeout(r, 3500)).then(cached).then(hit => hit || net);
    e.respondWith(Promise.race([net, slow]));
    return;
  }

  // arquivos do próprio site (ícones, manifest): cache primeiro
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});

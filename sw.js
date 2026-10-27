/* Service worker do Pokégotchi: deixa o jogo instalável e jogável offline.
   O build (tools/build.php) troca o marcador da versão por um hash do index.html, manifest e ícones,
   então cada publicação nova gera um cache novo e apaga o antigo. */
const VERSION = '443175d6c5';
const CORE = `pokegotchi-core-${VERSION}`;
const RUNTIME = 'pokegotchi-runtime-v1';   // fontes do Google (de outro domínio)
const CORE_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
const EXTERNAL = /^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
const SCOPE = new URL('./', self.location).pathname;   // ex.: /pokegotchi/

// externos são buscados em modo CORS para o status ser conhecido (nunca guardar erro opaco no cache)
async function fetchExternal(url) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (res.ok) await (await caches.open(RUNTIME)).put(url, res.clone());
  return res;
}

// Pré-carrega as fontes já na instalação: a 1ª visita não passa pelo SW, e sem isso o 1º uso offline ficaria sem a fonte
async function warmExternal() {
  try {
    const css = await (await fetchExternal(FONT_CSS)).clone().text();
    const fonts = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(fonts.map(fetchExternal));
  } catch { /* sem internet ou bloqueado: o jogo funciona com a fonte do sistema */ }
}

self.addEventListener('install', e => {
  // cache: 'reload' pula o cache HTTP do GitHub Pages (10 min): a versão nova nunca guarda a página velha
  const fresh = CORE_FILES.map(u => new Request(u, { cache: 'reload' }));
  e.waitUntil(caches.open(CORE).then(c => c.addAll(fresh)).then(warmExternal).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('pokegotchi-core-') && k !== CORE).map(k => caches.delete(k))))
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
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CORE).then(c => c.put('./index.html', copy)); return res; }
          return caches.match('./index.html').then(hit => hit || res);   // erro do servidor: abre a cópia que já temos
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./'))),
    );
    return;
  }

  // arquivos do próprio site (ícones, manifest): cache primeiro
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // fontes: entrega o que está em cache e atualiza em segundo plano
  if (EXTERNAL.test(url.hostname)) {
    e.respondWith(caches.match(req.url, { cacheName: RUNTIME }).then(hit => {
      const net = fetchExternal(req.url).catch(() => fetch(req)).catch(() => hit || Response.error());
      return hit || net;
    }));
  }
});

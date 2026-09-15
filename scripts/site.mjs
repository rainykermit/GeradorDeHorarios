// Prepara a pasta site/ para publicar o Gerador de Horários como site.
// Inclui manifesto e service worker: o site funciona sem internet depois da primeira visita
// e pode ser "instalado" a partir do Chrome/Edge (ícone no ambiente de trabalho).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'site');
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

let html = fs.readFileSync(path.join(raiz, 'dist/index.html'), 'utf8');
const extra = `
    <link rel="manifest" href="./manifest.webmanifest" />
    <meta name="theme-color" content="#1f5fbf" />
    <link rel="apple-touch-icon" href="./icon-512.png" />
    <script>
      if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
        window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js'); });
      }
    </script>`;
html = html.replace('</head>', `${extra}\n  </head>`);
fs.writeFileSync(path.join(destino, 'index.html'), html);

fs.copyFileSync(path.join(raiz, 'build/icon.png'), path.join(destino, 'icon-512.png'));
const icone192 = path.join(raiz, 'build/icon-192.png');
if (fs.existsSync(icone192)) fs.copyFileSync(icone192, path.join(destino, 'icon-192.png'));

fs.writeFileSync(
  path.join(destino, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Gerador de Horários',
      short_name: 'Horários',
      description: pkg.description,
      lang: 'pt-PT',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f3f5f9',
      theme_color: '#1f5fbf',
      icons: [
        ...(fs.existsSync(icone192) ? [{ src: './icon-192.png', sizes: '192x192', type: 'image/png' }] : []),
        { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(destino, 'sw.js'),
  `// Guarda a aplicação para funcionar sem internet; atualiza em segundo plano.
const CACHE = 'gerador-de-horarios-${pkg.version}-${Date.now()}';
const FICHEIROS = ['./', './index.html', './manifest.webmanifest', './icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHEIROS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    // A página: primeiro a rede (versão mais recente); sem internet, a cópia guardada.
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copia));
          }
          return r;
        })
        .catch(() => caches.match('./index.html').then((g) => g || caches.match('./'))),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((guardado) => {
      const rede = fetch(e.request)
        .then((r) => {
          if (r.ok) {
            // A cópia tem de ser feita já: depois de a resposta ser lida já não é possível.
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copia));
          }
          return r;
        })
        .catch(() => guardado);
      return guardado || rede;
    }),
  );
});
`,
);

console.log('Site pronto em', destino);

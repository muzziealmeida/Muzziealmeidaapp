// Do not cache client documents, API responses, or authenticated pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title><body style="font:18px system-ui;padding:40px;background:#3d3f56;color:white"><h1>Você está sem conexão</h1><p>Conecte-se à internet para acessar seus dados com segurança.</p><button onclick="location.reload()">Tentar novamente</button></body></html>', {headers:{'Content-Type':'text/html; charset=utf-8'}})));
  }
});

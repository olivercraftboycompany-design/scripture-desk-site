'use strict';
const PREFIX='scripture-desk-';
const NAME=PREFIX+'v7';
const SHELL=['./','index.html','app.js','style.css','ai-config.json','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable.png','data/library.json','data/WEB/1.json','data/CPDV/1.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const dest=await caches.open(NAME);for(const key of await caches.keys()){if(!key.startsWith(PREFIX)||key===NAME)continue;const old=await caches.open(key);for(const req of await old.keys()){const relative=new URL(req.url).pathname.slice(new URL(self.registration.scope).pathname.length);if(!/^data\/[A-Z0-9]+\/\d+\.json$/.test(relative)||await dest.match(req))continue;const res=await old.match(req);if(res)await dest.put(req,res);}await caches.delete(key);}await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const req=e.request, url=new URL(req.url), scope=new URL(self.registration.scope);
 if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const relative=url.pathname.slice(scope.pathname.length);
 if(relative.startsWith('api/'))return;
 if(req.mode==='navigate') {e.respondWith((async()=>{try{return await fetch(req)}catch{return (await caches.open(NAME)).match('index.html')}})());return;}
 if(!SHELL.includes(relative)&&!/^data\/[A-Z0-9]+\/\d+\.json$/.test(relative))return;
 e.respondWith((async()=>{const cache=await caches.open(NAME);if(relative!=='ai-config.json'){const hit=await cache.match(req);if(hit)return hit;}try{const live=await fetch(req);if(live.ok && !live.redirected) await cache.put(req,live.clone());return live;}catch{return (await cache.match(req))||Response.error()}})());
});

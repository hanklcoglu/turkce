/* Türkçe Antrenörü service worker - offline + background update */
const CACHE='tt-v1';
const CORE=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(req,{ignoreSearch:true});
    const network=fetch(req).then(res=>{
      if(res&&res.status===200&&res.type==='basic'){ cache.put(req,res.clone()); }
      return res;
    }).catch(()=>null);
    if(cached){ network; return cached; }
    const fresh=await network;
    if(fresh) return fresh;
    return cache.match('./index.html')||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
  })());
});
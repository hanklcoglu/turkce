/* Türkçe Antrenörü service worker
   index.html: network-first (so a new build lands on the very next open),
   falling back to cache when offline or slow.
   everything else: cache-first with a background refresh.
   plus: shows push reminders and opens the right screen when tapped.     */
const CACHE='tt-v3';
const CORE=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const DOC_TIMEOUT=4000;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function isDoc(req,url){
  return req.mode==='navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('/index.html');
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);

    if(isDoc(req,url)){
      try{
        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),DOC_TIMEOUT);
        const res=await fetch(req,{signal:ctrl.signal,cache:'no-store'});
        clearTimeout(timer);
        if(res&&res.status===200){
          cache.put('./index.html',res.clone());
          cache.put('./',res.clone());
          return res;
        }
      }catch(err){}
      return (await cache.match('./index.html'))
          || (await cache.match(req,{ignoreSearch:true}))
          || new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
    }

    const cached=await cache.match(req,{ignoreSearch:true});
    const network=fetch(req).then(res=>{
      if(res&&res.status===200&&res.type==='basic'){ cache.put(req,res.clone()); }
      return res;
    }).catch(()=>null);
    if(cached){ network; return cached; }
    const fresh=await network;
    if(fresh) return fresh;
    return (await cache.match('./index.html'))||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
  })());
});

/* ---- reminders ---- */

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch(err){ d = { title: 'Türkçe Antrenörü', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Türkçe Antrenörü', {
    body:  d.body || '',
    icon:  './icon-192.png',
    badge: './icon-192.png',
    tag:   d.tag || 'general',
    renotify: false,
    data:  { url: d.url || '' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '';
  const target = self.registration.scope + (hash || '');
  e.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for(const c of clients){
      if(c.url.indexOf(self.registration.scope) === 0){
        /* already open: bring it forward, and jump to the right screen if asked */
        if(hash && 'navigate' in c){ try { await c.navigate(target); } catch(err){} }
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

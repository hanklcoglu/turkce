/* Türkçe Antrenörü service worker
   index.html: network-first (so a new build lands on the very next open),
   falling back to cache when offline or slow.
   everything else: cache-first with a background refresh.                */
const CACHE='tt-v2';
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


const cache="finora-17ef60d1fdf60711";
self.addEventListener('install',event=>event.waitUntil(caches.open(cache).then(c=>c.addAll(["/","/index.html","/manifest.webmanifest","/assets/browser-Bi1SjHOd.js","/assets/charts-B_U-R5so.js","/assets/html2canvas-DgyG5QR-.js","/assets/index-Ds_aXAhk.js","/assets/index-Sxlkej0d.css","/assets/index.es-By3wojTk.js","/assets/jspdf.es.min-C4oJ19e8.js","/assets/purify.es-BQJV6A36.js","/assets/react-runtime-BHG5-uDH.js","/assets/rolldown-runtime-BCiCTKAo.js","/assets/src-BmUdCsRu.js","/assets/validation-56qrBjIg.js","/assets/xlsx-NOtQCjcd.js","/icons/apple.png","/icons/horizontal.svg","/icons/logo.svg","/icons/mark.svg","/icons/maskable.png","/icons/pwa-192.png","/icons/pwa-512.png","/icons/splash.png"]))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('finora-')&&key!==cache)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('push',event=>{
 if(!event.data)return;
 try{if(event.data.json().type!=='reminder')return}catch{return}
 event.waitUntil(self.registration.showNotification('FINORA',{body:'Buka FINORA untuk meninjau pengingat Anda.',icon:'/icons/pwa-192.png',tag:'finora-reminder'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const views=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const view=views.find(client=>new URL(client.url).origin===self.location.origin);
  if(view){await view.focus();return}
  await self.clients.openWindow('/');
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/'))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.open(cache).then(c=>c.match('/index.html'))));return;
 }
 if(!url.pathname.match(/^\/(assets|icons|ocr)\//)&&url.pathname!=='/manifest.webmanifest')return;
 event.respondWith((async()=>{
  const c=await caches.open(cache);
  const hit=await c.match(req,{ignoreVary:true});if(hit)return hit;
  const response=await fetch(req);
  if(response.ok)await c.put(req,response.clone());
  return response;
 })());
});

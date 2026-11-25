import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const files = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  ...(await readdir('dist/assets').then((names) =>
    names.map((n) => '/assets/' + n),
  )),
  ...(await readdir('dist/icons').then((names) =>
    names.map((n) => '/icons/' + n),
  )),
]
const hash = createHash('sha256')
for (const path of files.slice(1)) hash.update(await readFile('dist' + path))
const cache = 'finora-' + hash.digest('hex').slice(0, 16)
await writeFile(
  'dist/sw.js',
  `
const cache=${JSON.stringify(cache)};
self.addEventListener('install',event=>event.waitUntil(caches.open(cache).then(c=>c.addAll(${JSON.stringify(files)}))));
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
 if(!url.pathname.match(/^\\/(assets|icons|ocr)\\//)&&url.pathname!=='/manifest.webmanifest')return;
 event.respondWith((async()=>{
  const c=await caches.open(cache);
  const hit=await c.match(req,{ignoreVary:true});if(hit)return hit;
  const response=await fetch(req);
  if(response.ok)await c.put(req,response.clone());
  return response;
 })());
});
`,
)

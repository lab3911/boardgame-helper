
const CACHE='bgh-lisa-v1';
const ASSETS=['./','./index.html','./assets/css/style.css','./assets/js/app.js','./assets/img/favicon.svg','./assets/img/icon-192.png','./assets/img/icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(ASSETS.includes(url.pathname.replace(location.origin,''))){
    e.respondWith(caches.match(e.request));
  }
});

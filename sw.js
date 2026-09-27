const CACHE="caa-v1-web3";
const SHELL=["./","./index.html","./style.css","./app.js","./manifest.webmanifest",
"https://unpkg.com/jspsych@8.3.0",
"https://unpkg.com/jspsych@8.3.0/css/jspsych.css",
"https://unpkg.com/@jspsych/plugin-html-button-response@2.1.0",
"https://unpkg.com/@jspsych/plugin-html-keyboard-response@2.2.0",
"https://unpkg.com/@jspsych/plugin-survey-html-form@2.1.0",
"https://unpkg.com/@jspsych/plugin-instructions@2.1.0"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET") return;
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{
   const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}); return r;
 }).catch(()=>caches.match("./index.html"))));
});
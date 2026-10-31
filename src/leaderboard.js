import { validTime,PHYSICS_VERSION } from './results.js';
const CACHE_KEY='roadrushers.ai-leaderboards.v1';
const clean=entries=>Array.isArray(entries)&&entries.length===50&&entries.every(e=>validTime(e.bestLap)&&(e.totalTime==null||validTime(e.totalTime)))?
  entries.map((e,i)=>({id:`ai-${i}`,name:String(e.name).slice(0,32),bestLap:e.bestLap,totalTime:e.totalTime,simulated:true})):null;

/** Replace this provider with a verified server response when online rankings exist. */
export function loadAILeaderboard(context,{storage,signal,workerFactory=()=>new Worker(new URL('./ranking-worker.js',import.meta.url),{type:'module'})}={}){
  const key=`${PHYSICS_VERSION}:${context.key}:${context.laps}`;let cache={};
  try{cache=JSON.parse(storage?.getItem(CACHE_KEY)||'{}')||{};const hit=clean(cache[key]?.entries);if(hit)return Promise.resolve(hit);}catch{}
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Cancelado','AbortError'));return;}
    let worker;try{worker=workerFactory();}catch(error){reject(error);return;}
    const cleanup=()=>{clearTimeout(timeout);signal?.removeEventListener('abort',abort);worker.terminate();};
    const abort=()=>{cleanup();reject(new DOMException('Cancelado','AbortError'));};
    const timeout=setTimeout(()=>{cleanup();reject(Error('La estimación está tardando demasiado. Puedes volver a intentarlo.'));},20000);
    signal?.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>{cleanup();reject(Error('No se han podido calcular las referencias IA.'));};
    worker.onmessage=({data})=>{
      const entries=clean(data.entries);cleanup();
      if(!entries){reject(Error(data.error||'La estimación no es válida.'));return;}
      try{cache[key]={entries,updatedAt:Date.now()};const recent=Object.fromEntries(Object.entries(cache).sort((a,b)=>b[1].updatedAt-a[1].updatedAt).slice(0,24));storage?.setItem(CACHE_KEY,JSON.stringify(recent));}catch{}
      resolve(entries);
    };
    try{worker.postMessage(context);}catch(error){cleanup();reject(error);}
  });
}

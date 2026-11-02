export const RESULTS_KEY='roadrushers.results.v1';
export const PHYSICS_VERSION='drive-120hz-v2-150kph';
export const centiseconds=time=>Math.floor(time*100+1e-7);
export const validTime=t=>typeof t==='number'&&Number.isFinite(t)&&t>0&&t<=86400;
export function fingerprint(value){let hash=2166136261;for(const c of JSON.stringify(value)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}

/** Geometry and handling define a category; paint, camera and scenery do not. */
export function resultContext(settings,circuit){
  const t=settings.track,v=settings.vehicle;
  const geometry={points:t.points,layout:t.layout,width:t.width,widthProfile:t.widthProfile,smoothing:t.cornerSmoothing,
    startHeight:t.startHeight,closed:t.closed,zones:t.zones,surface:t.surface,props:(t.manualProps||[]).filter(p=>p.collision)};
  const handling=Object.fromEntries(['id','speed','grip','acceleration','turn','response','yawResponse','drift','looseGrip','bodyWidth','bodyLength'].map(k=>[k,v[k]]));
  const category={physics:PHYSICS_VERSION,geometry,handling,surface:settings.surface,weather:settings.weather,pace:settings.pace,
    mode:settings.mode,interaction:settings.mode==='race'?settings.raceRules.interaction:'solo',count:settings.mode==='race'?settings.raceRules.count:1};
  return {key:fingerprint(category),category,track:t,vehicle:v,length:circuit.length,surface:settings.surface,weather:settings.weather,pace:settings.pace,
    mode:settings.mode,interaction:category.interaction,count:category.count,laps:settings.mode==='race'?settings.raceRules.laps:0};
}
export class ResultRecords{
  constructor(storage){this.storage=storage;this.entries={};this.saveAvailable=Boolean(storage);try{const saved=JSON.parse(storage?.getItem(RESULTS_KEY)||'null');if(saved?.version===1&&saved.entries&&typeof saved.entries==='object')this.entries=saved.entries;}catch{this.saveAvailable=false;}}
  get(context){
    const entry=this.entries[context.key],totals={};
    for(const [laps,time]of Object.entries(entry?.totals||{}))if(/^[1-9]\d?$/.test(laps)&&validTime(time))totals[laps]=time;
    return {bestLap:validTime(entry?.bestLap)?entry.bestLap:null,totals};
  }
  recordLap(context,time){if(!validTime(time))return;const entry=this.get(context);this.write(context,{...entry,bestLap:Math.min(entry.bestLap??Infinity,time)});}
  recordSession(context,lapTimes,totalTime,complete){
    if(!Array.isArray(lapTimes)||!lapTimes.every(validTime)||!validTime(totalTime)||lapTimes.reduce((s,t)=>s+t,0)>totalTime+.00001)throw Error('Tiempos de sesión no válidos');
    if(complete&&context.mode==='race'&&(lapTimes.length!==context.laps||Math.abs(lapTimes.reduce((s,t)=>s+t,0)-totalTime)>.00001))throw Error('La carrera no contiene todas las vueltas completas.');
    const previous=this.get(context),bestLap=lapTimes.length?Math.min(...lapTimes):null;
    const record={bestLap:bestLap==null?previous.bestLap:Math.min(previous.bestLap??Infinity,bestLap),totals:{...previous.totals}};
    if(complete&&context.mode==='race'&&lapTimes.length===context.laps&&Math.abs(lapTimes.reduce((s,t)=>s+t,0)-totalTime)<.00001)record.totals[context.laps]=Math.min(record.totals[context.laps]??Infinity,totalTime);
    this.write(context,record);return {previous,...record,newLapRecord:bestLap!=null&&(previous.bestLap==null||centiseconds(bestLap)<centiseconds(previous.bestLap))};
  }
  write(context,record){
    this.entries[context.key]={...record,updatedAt:Date.now()};
    this.entries=Object.fromEntries(Object.entries(this.entries).sort((a,b)=>(b[1]?.updatedAt||0)-(a[1]?.updatedAt||0)).slice(0,100));
    try{this.storage?.setItem(RESULTS_KEY,JSON.stringify({version:1,entries:this.entries}));this.saveAvailable=Boolean(this.storage);}catch{this.saveAvailable=false;}
  }
}

export function createReport({context,lapTimes,totalTime,complete=true,position=null,racers=[],records,previousBestLap}){
  const result=records.recordSession(context,lapTimes,totalTime,complete),personalBest=Math.min(result.bestLap??Infinity,previousBestLap??Infinity);
  if(Number.isFinite(personalBest))records.recordLap(context,personalBest);
  const bestLap=lapTimes.length?Math.min(...lapTimes):null;
  return {context,lapTimes:[...lapTimes],totalTime,complete,position,racers,bestLap,personalBest:Number.isFinite(personalBest)?personalBest:null,
    personalTotal:result.totals[context.laps]??null,newLapRecord:bestLap!=null&&centiseconds(bestLap)<centiseconds((previousBestLap===undefined?result.previous.bestLap:previousBestLap)??Infinity),
    partialTime:Math.max(0,totalTime-lapTimes.reduce((s,t)=>s+t,0)),saved:records.saveAvailable,
    tab:'times',metric:'lap',leaderboard:{status:'loading',entries:[]}};
}

export function estimatedStanding(entries,metric,personalTime){
  const field=metric==='total'?'totalTime':'bestLap';
  const all=entries.filter(e=>validTime(e[field])).map(e=>({...e,time:e[field],isPlayer:false}));
  if(validTime(personalTime))all.push({id:'you',name:'TÚ',isPlayer:true,time:personalTime});
  all.sort((a,b)=>centiseconds(a.time)-centiseconds(b.time)||(a.isPlayer?-1:b.isPlayer?1:a.id.localeCompare(b.id)));
  let prior=null,rank=0;for(let i=0;i<all.length;i++){const score=centiseconds(all[i].time);if(score!==prior)rank=i+1;all[i].rank=rank;prior=score;}
  return {rows:all.slice(0,50),player:all.find(e=>e.isPlayer)||null,leader:all[0]?.time??null};
}

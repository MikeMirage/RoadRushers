/** Offline league: deterministic rewards, resumable events and atomic save transactions. */
import {VEHICLES} from './config.js';
import {vehiclePowerClass} from './vehicle-regulations.js';
export const LEAGUE_KEY='prl.league.v1';
const points=[12,9,7,5,4,3,2,1,0,0,0,0];
export const LICENSES=['Club','Sport','Pro'];
export const EVENTS=[
 {id:'club',name:'Copa de iniciación',kind:'cup',tier:0,category:'p1',tracks:['puerto','aserradero','faro'],laps:1,fee:0,prizes:[650,450,300,180],gift:'apex',description:'Tres circuitos. Tu primer podio abre Sport y te entrega el Apex.'},
 {id:'sport',name:'Sport Touring Series',kind:'cup',tier:1,category:'p2',tracks:['gp-silverstone-compact-v1','gp-suzuka-compact-v1','gp-interlagos-compact-v1'],laps:3,fee:0,prizes:[1300,900,650,350],gift:'c7-sport',description:'Tres mangas de tres vueltas. Un podio abre Pro y gana el C7 Sport.'},
 {id:'pro',name:'Grand Prix Masters',kind:'cup',tier:2,category:'p3',tracks:['gp-spa-compact-v1','gp-monza-compact-v1','gp-austin-compact-v1','gp-suzuka-compact-v1'],laps:3,fee:0,prizes:[2400,1600,1100,600],description:'Cuatro grandes premios. Consigue el trofeo de la liga.'},
 {id:'club-open',name:'Club Open',kind:'tournament',tier:0,category:'p1',qualifiers:['puerto','aserradero'],targets:[180,200],tracks:['faro','kit-club-v1','puerto'],laps:1,fee:200,prizes:[950,650,450,200],description:'Dos clasificatorias de una vuelta y tres finales. Cada corte exige un tiempo objetivo.'},
 {id:'sport-open',name:'Pacific Invitational',kind:'tournament',tier:1,category:'p2',qualifiers:['gp-suzuka-compact-v1','gp-silverstone-compact-v1'],targets:[240,240],tracks:['gp-suzuka-compact-v1','gp-interlagos-compact-v1','gp-monza-compact-v1'],laps:3,fee:500,prizes:[1900,1300,900,500],description:'Clasifica en dos GP. Inscripción solo al acceder a las finales; recuperada al completar las tres.'},
 {id:'suzuka-record',name:'Tu próxima mejor vuelta',kind:'challenge',tier:0,category:'any',tracks:['gp-suzuka-compact-v1'],targets:[240,170,130],laps:1,fee:0,description:'Suzuka · Bronce 4:00 · Plata 2:50 · Oro 2:10. Cada medalla tiene premio único.'},
 {id:'roadster',name:'Desafío roadster',kind:'challenge',tier:0,category:'same-model',loaner:'seven',tracks:['faro'],targets:[180,130,95],laps:1,fee:0,description:'Seven de préstamo · Bronce 3:00 · Plata 2:10 · Oro 1:35. Sin comprar ni mejorar el coche.'},
];
export const eventById=id=>EVENTS.find(e=>e.id===id);
export function carOffer(v){const tier={p1:0,p2:1,p3:2}[vehiclePowerClass(v)],index=VEHICLES.filter(c=>vehiclePowerClass(c)===vehiclePowerClass(v)).findIndex(c=>c.id===v.id);return {tier,price:[900,2800,6500][tier]+index*[80,140,450][tier]};}
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({version:1,name:'Piloto',credits:600,xp:0,owned:['coda','bambino'],stats:{races:0,wins:0,podiums:0,laps:0},cups:{},medals:{},records:{},ledger:[],run:null,pending:null});
export function licenseTier(s){return s.xp>=850&&s.cups.sport?.podium?2:s.xp>=240&&s.cups.club?.podium?1:0;}
export function nextLicense(s){return licenseTier(s)===0?'Sport: 240 XP + podio en Copa de iniciación':licenseTier(s)===1?'Pro: 850 XP + podio en Sport Touring Series':'Licencia Pro · todas las categorías abiertas';}
export class League {
 constructor(storage,{legacyVehicle}={}){this.storage=storage;this.saved=true;try{const raw=JSON.parse(storage?.getItem(LEAGUE_KEY)||'null');this.state=raw?.version===1?{...initial(),...raw}:initial();if(!raw){let old;try{old=JSON.parse(storage?.getItem('roadrushers.career.v1')||'null');}catch{}for(const id of [...(old?.unlocked||[]),legacyVehicle].filter(Boolean))if(VEHICLES.some(v=>v.id===id)&&!this.state.owned.includes(id))this.state.owned.push(id);this.persist(this.state);}}catch{this.state=initial();this.saved=false;}}
 persist(next){try{if(!this.storage)throw Error('storage');this.storage.setItem(LEAGUE_KEY,JSON.stringify(next));this.saved=true;}catch{this.saved=false;}this.state=next;return next;}
 transaction(fn){const next=clone(this.state),result=fn(next);this.persist(next);return result;}
 owns(id){return this.state.owned.includes(id);}
 buy(id){const v=VEHICLES.find(v=>v.id===id);if(!v)throw Error('Coche desconocido');const offer=carOffer(v);if(this.owns(id))throw Error('Ya está en tu garaje');if(licenseTier(this.state)<offer.tier)throw Error(`Requiere licencia ${LICENSES[offer.tier]}`);if(this.state.credits<offer.price)throw Error('No tienes suficientes créditos');return this.transaction(s=>{s.credits-=offer.price;s.owned.push(id);s.ledger.push({id:`purchase-${id}`,credits:-offer.price});s.ledger=s.ledger.slice(-200);return v;});}
 rename(name){this.transaction(s=>{s.name=String(name).trim().slice(0,20)||'Piloto';});}
 retire(){this.transaction(s=>{s.run=null;s.pending=null;});}
 begin(id,vehicleId,quick={}){
  const event=id==='quick'?null:eventById(id);if(id!=='quick'&&!event)throw Error('Evento desconocido');
  if(event&&licenseTier(this.state)<event.tier)throw Error(`Requiere licencia ${LICENSES[event.tier]}`);
  const vehicle=VEHICLES.find(v=>v.id===(event?.loaner||vehicleId));if(!vehicle||(!event?.loaner&&!this.owns(vehicle.id)))throw Error('Elige un coche de tu garaje');
  if(event&&event.category!=='any'&&event.category!=='same-model'&&vehiclePowerClass(vehicle)!==event.category)throw Error(`Este evento requiere ${event.category.toUpperCase()}`);
  if(this.state.run&&this.state.run.eventId!==id&&id!=='quick')throw Error('Termina o retira la competición en curso primero');
  return this.transaction(s=>{
   if(event&&!s.run)s.run={eventId:id,stage:0,qualifying:Boolean(event.qualifiers),scores:{},results:[],vehicleId:vehicle.id,paid:false};
   const run=event?s.run:null;if(run&&run.vehicleId!==vehicle.id)throw Error('Mantén el mismo coche durante la competición');
   if(run&&!run.qualifying&&!run.paid){if(s.credits<event.fee)throw Error('Créditos insuficientes para la final');s.credits-=event.fee;run.paid=true;}
   const qualifying=Boolean(run?.qualifying),stage=run?.stage||0;
   const attempt={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,eventId:id,vehicleId:vehicle.id,stage,qualifying,trackId:event?(qualifying?event.qualifiers[stage]:event.tracks[stage]):quick.trackId||'puerto',laps:event?(qualifying||event.kind==='challenge'?1:event.laps):quick.laps||1,count:event?4:quick.count||4,category:event?.category||quick.carCategory||'any',mode:qualifying||event?.kind==='challenge'?'practice':'race',difficulty:['novice','club','expert'][event?.tier||0]};
   s.pending=attempt;return clone(attempt);
  });
 }
 settle(attemptId,{complete,lapTimes=[],position=4,racers=[]}={}){
  const a=this.state.pending;if(!a||a.id!==attemptId||!complete||lapTimes.length<a.laps||lapTimes.some(t=>!Number.isFinite(t)||t<=0))return null;
  return this.transaction(s=>{
   const e=eventById(a.eventId),oldTier=licenseTier(s),run=e?s.run:null;let credits=0,xp=0,bonus=0,medal=0,gift=null,qualified=false,finished=false,rank=null;
   const best=Math.min(...lapTimes);s.records[a.trackId]=Math.min(s.records[a.trackId]||Infinity,best);s.stats.laps+=lapTimes.length;
   if(a.qualifying){qualified=best<=e.targets[a.stage];if(qualified){run.stage++;if(run.stage===e.qualifiers.length){run.stage=0;run.qualifying=false;}}}
   else if(e?.kind==='challenge'){
    medal=e.targets.filter(t=>best<=t).length;const previous=s.medals[e.id]||0;bonus=Math.max(0,medal-previous)*150;credits=medal?50+bonus:0;xp=medal?15+Math.max(0,medal-previous)*25:0;s.medals[e.id]=Math.max(previous,medal);s.run=null;finished=true;
   }else{
    s.stats.races++;s.stats.wins+=position===1?1:0;s.stats.podiums+=position<=3?1:0;
    credits=60+([180,130,100][position-1]||70);xp=40+(position<=3?20:0);
    if(run){
     const field=racers.length?racers:[{id:'player',isPlayer:true},...Array.from({length:a.count-1},(_,i)=>({id:`rival-${i+1}`}))];
     for(const [i,r]of field.entries()){const place=r.isPlayer?position:i+1;run.scores[r.id]=(run.scores[r.id]||0)+(points[place-1]||0);}
     run.results.push({trackId:a.trackId,position,best});run.stage++;
     if(run.stage===e.tracks.length){
      finished=true;rank=Object.entries(run.scores).sort((x,y)=>y[1]-x[1]||(x[0]==='player'?1:-1)).findIndex(([id])=>id==='player')+1;
      credits+=e.prizes[Math.min(3,rank-1)];xp+=100;
      const old=s.cups[e.id];bonus=!old&&rank<=3?150:0;credits+=bonus;
      s.cups[e.id]={bestRank:Math.min(old?.bestRank||99,rank),podium:Boolean(old?.podium||rank<=3),completions:(old?.completions||0)+1,scores:clone(run.scores)};
      if(rank<=3&&e.gift&&!s.owned.includes(e.gift)){s.owned.push(e.gift);gift=e.gift;}
      s.run=null;
     }
    }
   }
   s.credits+=credits;s.xp+=xp;s.pending=null;
   const receipt={id:a.id,eventId:a.eventId,credits,xp,bonus,medal,gift,qualified,qualifying:a.qualifying,finished,rank,license:licenseTier(s)>oldTier?LICENSES[licenseTier(s)]:null};
   s.ledger.push(receipt);s.ledger=s.ledger.slice(-200);return receipt;
  });
 }
}

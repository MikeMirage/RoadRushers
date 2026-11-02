/** Local economic authority. UI animation never grants currency. */
import {VEHICLES} from './config.js';
import {vehiclePowerClass} from './vehicle-regulations.js';
import {League as LegacyLeague,EVENTS as OLD_EVENTS,licenseTier,nextLicense,LICENSES} from './league-legacy.js';
import {LEAGUES,leagueById,acquisition,UPGRADE_CARDS,UPGRADE_COSTS,FREE_TRACKS,BALANCE_VERSION,freeRacePrizes,isFreeRaceEligible} from './economy-config.js';
export {licenseTier,nextLicense,LICENSES,LEAGUES,acquisition};
export const LEAGUE_KEY='prl.league.v2';
const clone=x=>JSON.parse(JSON.stringify(x));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const validId=id=>VEHICLES.some(v=>v.id===id);
const number=(x,d=0)=>Number.isFinite(x)&&x>=0?Math.min(1e9,Math.floor(x)):d;
export const EVENTS=[...OLD_EVENTS.map(e=>({...e,fee:e.id==='club-open'?300:e.id==='sport-open'?1200:e.fee,cap:e.tier===0?2:e.tier===1?3:5,
 prizes:({club:[300,220,160,100],sport:[700,500,350,200],pro:[1200,850,600,350],'club-open':[1000,450,150,0],'sport-open':[4000,1800,600,0]})[e.id]||e.prizes,
 description:e.kind==='tournament'?'Clasificatorias gratuitas y tres finales. Una entrada; el premio depende de tu puesto.':e.description})),
 {id:'masters-open',name:'Masters Invitational',kind:'tournament',tier:2,category:'p3',qualifiers:['gp-suzuka-compact-v1','gp-silverstone-compact-v1'],targets:[130,125],tracks:['gp-spa-compact-v1','gp-monza-compact-v1','gp-austin-compact-v1'],laps:3,fee:3000,prizes:[10000,4500,1500,0],cap:5,description:'Tres grandes premios contra IA. Inscripción única tras clasificar.'},
 ...LEAGUES.map(l=>({id:`duel-${l.id}`,name:`Duelo · ${l.name}`,kind:'duel',league:l.id,tier:l.tier,category:l.category,tracks:l.tracks,laps:1,fee:l.fee,prizes:[l.fee*2,0],cap:l.cap,description:'Duelo contra IA. Victoria: doble de la entrada. Derrota: pierdes la entrada. Cartas y dominio al terminar.'}))];
export const eventById=id=>EVENTS.find(e=>e.id===id);
export const carOffer=v=>({...acquisition(v.id),tier:{p1:0,p2:1,p3:2}[vehiclePowerClass(v)]});
const extend=s=>({...s,version:2,balanceVersion:BALANCE_VERSION,revision:0,cards:{},levels:{},mastery:{},opened:['club'],focus:'borough',claims:{},validFinishes:0,boxIndex:0,reserve:{series:0,special:0,icon:0},recordDetails:{},animations:true,telemetry:[]});
function clean(raw){
 if(raw?.version!==2)throw Error('Versión de guardado no compatible');
 const base=new LegacyLeague(null).state;
 const s={...extend(base),...raw};
 s.credits=number(raw.credits,600);s.xp=number(raw.xp);s.revision=number(raw.revision);
 s.owned=[...new Set(['coda','bambino',...(Array.isArray(raw.owned)?raw.owned.filter(validId):[])])];
 for(const key of ['cards','levels','mastery','claims','cups','medals','records','recordDetails','reserve'])if(!s[key]||typeof s[key]!=='object'||Array.isArray(s[key]))s[key]={};
 s.cards=Object.fromEntries(VEHICLES.map(v=>[v.id,number(s.cards[v.id])]));
 s.levels=Object.fromEntries(s.owned.map(id=>[id,Math.max(1,Math.min(5,number(s.levels[id],1)))]));
 s.mastery=Object.fromEntries(LEAGUES.map(l=>[l.id,Math.min(l.masteryCap,number(s.mastery[l.id]))]));
 s.opened=[...new Set(['club',...(Array.isArray(s.opened)?s.opened.filter(id=>leagueById(id)):[])])];
 s.stats=Object.fromEntries(Object.keys(base.stats).map(k=>[k,number(s.stats?.[k])]));
 s.ledger=Array.isArray(s.ledger)?s.ledger.slice(-200):[];s.telemetry=Array.isArray(s.telemetry)?s.telemetry.slice(-500):[];
 s.validFinishes=number(s.validFinishes);s.boxIndex=number(s.boxIndex);
 s.focus=validId(s.focus)?s.focus:'borough';s.name=String(s.name||'Piloto').slice(0,20);
 if(s.run){const e=eventById(s.run.eventId);if(!e||!s.owned.includes(s.run.vehicleId)&&e.loaner!==s.run.vehicleId||!Number.isInteger(s.run.stage)||s.run.stage<0||s.run.stage>=(s.run.qualifying?e.qualifiers?.length:e.tracks.length))throw Error('Competición guardada inválida; exporta el progreso para recuperarlo');}
 s.pending=null;return s;
}
function refreshUnlocks(s){
 for(const l of LEAGUES.slice(1)){
  const prev=LEAGUES[l.index-1];
  if(s.opened.includes(prev.id)&&s.owned.length>=l.owned&&licenseTier(s)>=l.tier&&(s.mastery[prev.id]||0)>=l.previousMastery&&s.owned.some(id=>vehiclePowerClass(VEHICLES.find(v=>v.id===id))===l.category)&&!s.opened.includes(l.id))s.opened.push(l.id);
 }
}
export class League {
 constructor(storage,{legacyVehicle}={}){
  this.storage=storage;this.saved=true;this.readOnly=false;
  try{
   const raw=storage?.getItem(LEAGUE_KEY);
   if(raw)this.state=clean(JSON.parse(raw));
   else{
    const legacy=new LegacyLeague({getItem:k=>storage?.getItem(k),setItem:()=>{}},{legacyVehicle});
    // Preserve original v1 verbatim. An in-progress run retains its old rule table.
    if(storage?.getItem('prl.league.v1')){const old=JSON.parse(storage.getItem('prl.league.v1'));if(old.version!==1)throw Error('Guardado anterior incompatible');}
    this.state=extend(legacy.state);this.state.migratedFrom=storage?.getItem('prl.league.v1')?'v1':null;
    if(this.state.run)this.state.run.legacyRules=true;
    for(const id of this.state.owned)this.state.levels[id]=1;
    this.persist(this.state);
   }
  }catch(error){this.state=extend(new LegacyLeague(null).state);this.saved=false;this.readOnly=true;this.error=error.message;}
 }
 persist(s){
  if(this.readOnly){this.saved=false;this.state=s;return s;}
  try{if(!this.storage)throw Error('Sin almacenamiento');this.storage.setItem(LEAGUE_KEY,JSON.stringify(s));this.saved=true;}catch{this.saved=false;}
  this.state=s;return s;
 }
 transaction(fn){
  if(this.saved&&this.storage){const raw=this.storage.getItem(LEAGUE_KEY);if(raw&&number(JSON.parse(raw).revision)!==this.state.revision)throw Error('El progreso cambió en otra pestaña. Recarga antes de continuar.');}
  const s=clone(this.state),result=fn(s);refreshUnlocks(s);s.revision++;s.balanceVersion=BALANCE_VERSION;this.persist(s);return result;
 }
 // Web Locks serializes writers across tabs; synchronous revision check rejects stale UI.
 async execute(fn){return globalThis.navigator?.locks?globalThis.navigator.locks.request(LEAGUE_KEY,()=>fn()):fn();}
 owns(id){return this.state.owned.includes(id);}
 level(id){return this.state.levels[id]||1;}
 available(id,s=this.state){return s.opened.includes(acquisition(id).league)||s.owned.includes(id)||Boolean(s.claims[`contract-${id}`]);}
 event(id){return this.state.run?.eventId===id&&this.state.run.legacyRules?OLD_EVENTS.find(e=>e.id===id):eventById(id);}
 rename(name){this.transaction(s=>{s.name=String(name).trim().slice(0,20)||'Piloto';});}
 setFocus(id){if(!validId(id)||!this.available(id)||this.level(id)===5)throw Error('Elige un coche disponible sin maximizar');this.transaction(s=>{s.focus=id;});}
 setAnimations(value){this.transaction(s=>{s.animations=Boolean(value);});}
 export(){return JSON.stringify({exportedAt:new Date().toISOString(),profile:this.state,originalV1:this.storage?.getItem('prl.league.v1'),originalV2:this.readOnly?this.storage?.getItem(LEAGUE_KEY):undefined},null,2);}
 addCards(s,id,count,awards){
  if(!count)return;
  const b=acquisition(id).band;
  if((s.levels[id]||1)>=5){id=VEHICLES.find(v=>acquisition(v.id).band===b&&this.available(v.id,s)&&(s.levels[v.id]||1)<5)?.id;if(!id){s.reserve[b]=number(s.reserve[b])+count;awards.push({reserve:b,count});return;}}
  s.cards[id]=number(s.cards[id])+count;awards.push({id,count});
 }
 receipt(s,r){s.ledger.push(r);s.ledger=s.ledger.slice(-200);s.telemetry.push({type:r.type||'reward_settled',id:r.id,eventId:r.eventId,credits:r.credits||0,balance:s.credits,version:BALANCE_VERSION});s.telemetry=s.telemetry.slice(-500);return clone(r);}
 unlock(id){
  if(!validId(id)||this.owns(id))throw Error('Coche desconocido o ya desbloqueado');
  if((this.state.cards[id]||0)<acquisition(id).cards)throw Error('Faltan cartas para desbloquear');
  return this.transaction(s=>{s.cards[id]-=acquisition(id).cards;s.owned.push(id);s.levels[id]=1;return this.receipt(s,{id:uid(),type:'vehicle_unlocked',gift:id,credits:0,balanceAfter:s.credits});});
 }
 upgrade(id){
  const v=VEHICLES.find(v=>v.id===id),n=this.level(id),cost=v&&UPGRADE_COSTS[vehiclePowerClass(v)][n-1],cards=UPGRADE_CARDS[n-1];
  if(!v||!this.owns(id)||n>=5)throw Error('Este coche no admite otra mejora');
  if(this.state.credits<cost||(this.state.cards[id]||0)<cards)throw Error('Faltan créditos o cartas');
  if(this.state.run?.vehicleId===id)throw Error('Termina la competición antes de mejorar este coche');
  return this.transaction(s=>{s.credits-=cost;s.cards[id]-=cards;s.levels[id]=n+1;const awards=[];if(n+1===5&&s.cards[id]){const extra=s.cards[id];s.cards[id]=0;this.addCards(s,id,extra,awards);}return this.receipt(s,{id:uid(),type:'vehicle_upgraded',vehicleId:id,level:n+1,credits:-cost,cards:awards,balanceAfter:s.credits});});
 }
 buy(){throw Error('Completa las cartas del coche para desbloquearlo gratis');}
 retire(){return this.transaction(s=>{s.run=null;s.pending=null;});}
 quote(id,vehicleId){const e=this.event(id);if(!e)throw Error('Evento desconocido');const fee=this.state.run?.eventId===id?(this.state.run.paid||this.state.run.qualifying?0:e.fee):e.qualifiers?0:e.fee;return {eventId:id,vehicleId,fee,revision:this.state.revision,balanceAfter:this.state.credits-fee};}
 begin(id,vehicleId,quick={}){
  if(this.state.run?.legacyRules&&id===this.state.run.eventId)return LegacyLeague.prototype.begin.call(this,id,vehicleId,quick);
  const e=id==='quick'?null:eventById(id),v=VEHICLES.find(v=>v.id===(e?.loaner||vehicleId));
  if(id!=='quick'&&!e)throw Error('Evento desconocido');
  if(!v||!e?.loaner&&!this.owns(v.id))throw Error('Elige un coche de tu garaje');
  if(e&&(licenseTier(this.state)<e.tier||e.league&&!this.state.opened.includes(e.league)))throw Error('Esta liga o licencia todavía está bloqueada');
  if(e&&!['any','same-model'].includes(e.category)&&vehiclePowerClass(v)!==e.category)throw Error(`Necesitas un coche ${e.category.toUpperCase()}`);
  if(this.state.run&&id!==this.state.run.eventId&&id!=='quick')throw Error('Continúa o retira la competición pendiente');
  if(quick.quoteRevision!=null&&quick.quoteRevision!==this.state.revision)throw Error('La inscripción cambió. Revisa el importe de nuevo.');
  return this.transaction(s=>{
   if(e&&!s.run)s.run={eventId:id,stage:0,qualifying:Boolean(e.qualifiers),scores:{},times:{},lastPositions:{},results:[],vehicleId:v.id,paid:false,level:Math.min(this.level(v.id),e.cap||5),balanceVersion:BALANCE_VERSION};
   const run=e?s.run:null;if(run&&run.vehicleId!==v.id)throw Error('Mantén el coche de la competición');
   let debit=0;if(run&&!run.qualifying&&!run.paid){debit=e.fee;if(s.credits<debit)throw Error('Créditos insuficientes; juega una carrera libre');s.credits-=debit;run.paid=true;run.entryPaid=debit;if(debit)this.receipt(s,{id:uid(),type:'entry_paid',eventId:id,credits:-debit,balanceAfter:s.credits});}
   const qualifying=Boolean(run?.qualifying),stage=run?.stage||0;
   const trackId=e?(qualifying?e.qualifiers[stage]:e.kind==='duel'?e.tracks[(s.stats.races||0)%e.tracks.length]:e.tracks[stage]):quick.trackId||'puerto';
   const eligibleFree=!e&&isFreeRaceEligible({...quick,trackId});
   const attempt={id:uid(),eventId:id,vehicleId:v.id,stage,qualifying,trackId,laps:e?(qualifying||e.kind==='challenge'?1:e.laps):quick.laps||1,count:e?(e.kind==='duel'?2:4):quick.count||4,category:e?.category||quick.carCategory||'any',mode:qualifying||e?.kind==='challenge'||!e&&quick.mode==='practice'?'practice':'race',difficulty:['novice','club','expert'][e?.tier||0],level:run?.level||this.level(v.id),cap:e?.cap||5,focus:s.focus,debit,entryPaid:run?.entryPaid||0,eligible:Boolean(e)||eligibleFree,balanceBefore:s.credits,seed:run?.seed||number(s.stats.races)+1};
   if(run)run.seed=attempt.seed;s.pending=attempt;return clone(attempt);
  });
 }
 settle(attemptId,{complete,lapTimes=[],position=4,racers=[],contextSignature=''}={}){
  const a=this.state.pending;
  if(!a||a.id!==attemptId||!complete||lapTimes.length!==a.laps||lapTimes.some(t=>!Number.isFinite(t)||t<=0)||a.mode==='race'&&(!Number.isInteger(position)||position<1||position>a.count))return null;
  if(this.state.run?.legacyRules&&a.eventId===this.state.run.eventId)return LegacyLeague.prototype.settle.call(this,attemptId,{complete,lapTimes,position,racers});
  return this.transaction(s=>{
   const e=eventById(a.eventId),run=e?s.run:null,oldTier=licenseTier(s),opened=[...s.opened],awards=[];
   let credits=0,xp=0,medal=0,qualified=false,finished=false,rank=null,mastery=0,contract=null;
   const best=Math.min(...lapTimes),key=[contextSignature,a.trackId,a.vehicleId,a.level,'physics-v2',a.mode,a.category,a.difficulty,a.laps].join('|'),previous=s.recordDetails[key]?.time;
   const record=previous!=null&&best<previous?{time:best,previous,trackId:a.trackId,vehicleId:a.vehicleId,level:a.level}:null;
   if(previous==null||best<previous)s.recordDetails[key]={time:best,trackId:a.trackId,vehicleId:a.vehicleId,level:a.level};
   s.records[a.trackId]=Math.min(s.records[a.trackId]||Infinity,best);s.stats.laps+=a.laps;
   if(a.qualifying){qualified=best<=e.targets[a.stage];if(qualified){run.stage++;if(run.stage===e.qualifiers.length){run.stage=0;run.qualifying=false;}}}
   else if(e?.kind==='challenge'){
    medal=e.targets.filter(t=>best<=t).length;const prior=number(s.medals[e.id]);credits=Math.max(0,medal-prior)*150+(medal?50:0);xp=medal?15+Math.max(0,medal-prior)*25:0;s.medals[e.id]=Math.max(prior,medal);s.run=null;finished=true;
   }else{
    s.stats.races++;s.stats.wins+=position===1?1:0;s.stats.podiums+=position<=3?1:0;
    if(a.eligible){xp=40+(position===1||a.count>2&&position<=3?20:0);s.validFinishes++;this.addCards(s,a.focus,2,awards);
     if(!s.claims.firstContract){this.addCards(s,'borough',4,awards);s.claims.firstContract=true;}
     if(s.validFinishes%5===0){const pool=VEHICLES.filter(v=>this.available(v.id,s));const target=pool[s.boxIndex++%pool.length];this.addCards(s,target.id,4,awards);}
    }
    if(e?.kind==='duel'){
     const player=racers.find(r=>r.isPlayer),rival=racers.find(r=>!r.isPlayer);const tie=Number.isFinite(player?.finishTime)&&player.finishTime===rival?.finishTime;
     if(tie&&position===1)s.stats.wins--;credits=tie?e.fee:position===1?e.fee*2:0;mastery=tie||position!==1?6:12;s.mastery[e.league]=Math.min(leagueById(e.league).masteryCap,(s.mastery[e.league]||0)+mastery);s.run=null;finished=true;rank=tie?null:position;
    }else if(run){
     const field=racers.length===a.count&&racers.filter(r=>r.isPlayer).length===1&&new Set(racers.map(r=>r.id)).size===a.count?racers:null;
     if(!field)throw Error('La clasificación de la manga está incompleta');
     for(const [i,r]of field.entries()){const place=r.isPlayer?position:i+1;run.scores[r.id]=(run.scores[r.id]||0)+[12,9,7,5][place-1];run.lastPositions[r.id]=place;run.times[r.id]=Number.isFinite(r.finishTime)&&run.times[r.id]!==null?(run.times[r.id]||0)+r.finishTime:null;}
     run.results.push({trackId:a.trackId,position,best});run.stage++;
     if(run.stage===e.tracks.length){
      const playerId=field.find(r=>r.isPlayer).id;
      const cmp=(x,y)=>(run.scores[y]-run.scores[x])||((run.times[x]??Infinity)-(run.times[y]??Infinity))||(run.lastPositions[x]-run.lastPositions[y]);
      rank=1+Object.keys(run.scores).filter(id=>cmp(id,playerId)<0).length;
      credits=e.prizes[rank-1];xp+=100;finished=true;
      const old=s.cups[e.id];s.cups[e.id]={bestRank:Math.min(old?.bestRank||99,rank),podium:Boolean(old?.podium||rank<=3),completions:(old?.completions||0)+1,scores:clone(run.scores)};
      if(e.kind==='tournament')this.addCards(s,a.focus,[8,6,4,2][rank-1],awards);
      if(rank<=3&&e.gift&&!s.claims[`contract-${e.gift}`]){s.claims[`contract-${e.gift}`]=true;if(!s.owned.includes(e.gift)){this.addCards(s,e.gift,Math.max(0,acquisition(e.gift).cards-(s.cards[e.gift]||0)),awards);contract=e.gift;}}
      s.run=null;
     }
    }else{credits=a.eligible?freeRacePrizes(s)[position-1]||freeRacePrizes(s)[3]:0;finished=true;}
   }
   s.credits+=credits;s.xp+=xp;s.pending=null;refreshUnlocks(s);
   const fee=finished?a.entryPaid||0:0;
   return this.receipt(s,{id:a.id,eventId:a.eventId,credits,net:credits-fee,entry:fee,xp,cards:awards,cardBalances:Object.fromEntries(awards.filter(c=>c.id).map(c=>[c.id,s.cards[c.id]])),mastery,contract,record,medal,qualified,qualifying:a.qualifying,finished,rank,position,eligible:a.eligible,balanceBefore:a.balanceBefore,balanceAfter:s.credits,license:licenseTier(s)>oldTier?LICENSES[licenseTier(s)]:null,leagues:s.opened.filter(id=>!opened.includes(id))});
  });
 }
}

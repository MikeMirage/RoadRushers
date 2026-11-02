import test from 'node:test';
import assert from 'node:assert/strict';
import {League,LEAGUE_KEY,EVENTS,licenseTier,acquisition,LEAGUES} from '../src/league.js';
import {League as Legacy} from '../src/league-legacy.js';
import {VEHICLES} from '../src/config.js';
import {groups,upgradedVehicle,UPGRADE_COSTS} from '../src/economy-config.js';
import {vehiclePowerClass} from '../src/vehicle-regulations.js';
import {playgroundTracks,resolvePlayground} from '../src/playground.js';
import {renderLeague} from '../src/league-ui.js';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const field=(place,count=4)=>{const rivals=Array.from({length:count-1},(_,i)=>({id:`rival-${i}`,finishTime:80+i*5}));rivals.splice(place-1,0,{id:'player',isPlayer:true,finishTime:78+(place-1)*5});return rivals;};
const finish=(l,a,place=1)=>l.settle(a.id,{complete:true,lapTimes:Array(a.laps).fill(30),position:place,racers:field(place,a.count)});
const quick=l=>finish(l,l.begin('quick','coda',{trackId:'puerto',count:4,laps:1,mode:'race'}));
const cup=(l,id,car,place=1)=>{let r;for(const _ of EVENTS.find(e=>e.id===id).tracks)r=finish(l,l.begin(id,car),place);return r;};
test('catalogue covers every production ID exactly once and leagues resolve into real tracks',()=>{
 const ids=Object.values(groups).flat();assert.equal(ids.length,VEHICLES.length);assert.equal(new Set(ids).size,ids.length);
 for(const v of VEHICLES)assert(ids.includes(v.id));
 const tracks=playgroundTracks();for(const e of EVENTS)for(const id of [...e.tracks,...e.qualifiers||[]]){assert(tracks.some(t=>t.id===id),id);assert(!resolvePlayground({trackId:id,vehicleId:'coda',width:'original'}).error);}
 for(const l of LEAGUES.slice(1)){const prior=LEAGUES.slice(0,l.index).flatMap(x=>groups[x.id]);assert(prior.length>=l.owned);assert(prior.some(id=>vehiclePowerClass(VEHICLES.find(v=>v.id===id))===l.category));}
});
test('first car in three finishes, free unlock consumes cards, duplicate commands cannot pay twice',()=>{
 const l=new League(store());assert.equal(l.state.credits,600);quick(l);quick(l);const r=quick(l);assert.equal(l.state.cards.borough,10);assert.equal(l.state.credits,1020);
 const receipt=l.unlock('borough');assert.equal(receipt.gift,'borough');assert.equal(l.state.cards.borough,0);assert.equal(l.state.credits,1020);assert.throws(()=>l.unlock('borough'));
 assert.equal(l.settle(r.id,{complete:true,lapTimes:[30]}),null);
});
test('duel debits once, reload resumes paid attempt, loss pays cards but no CR',()=>{
 const st=store(),l=new League(st);let a=l.begin('duel-club','coda');assert.equal(l.state.credits,500);assert.equal(a.count,2);
 const loaded=new League(st);assert.equal(loaded.settle(a.id,{complete:true,lapTimes:[30],position:1}),null);
 a=loaded.begin('duel-club','coda');assert.equal(loaded.state.credits,500);const r=finish(loaded,a,2);assert.equal(r.credits,0);assert.equal(r.net,-100);assert.equal(r.mastery,6);assert.equal(loaded.state.credits,500);assert.equal(loaded.state.cards.borough,6);
 const win=finish(loaded,loaded.begin('duel-club','coda'));assert.equal(win.net,100);assert.equal(loaded.state.credits,600);
});
test('exact duel tie refunds fee without a win; abandonment never pays',()=>{
 const l=new League(store()),a=l.begin('duel-club','coda');const r=l.settle(a.id,{complete:true,lapTimes:[30],position:1,racers:[{id:'player',isPlayer:true,finishTime:30},{id:'rival-0',finishTime:30}]});assert.equal(r.net,0);assert.equal(r.mastery,6);assert.equal(l.state.credits,600);
 const b=l.begin('duel-club','coda');l.retire();assert.equal(finish(l,b),null);assert.equal(l.state.credits,500);
});
test('no rewards for practice, custom tracks, extra laps or incomplete evidence',()=>{
 for(const args of [{mode:'practice'},{trackId:'custom'},{laps:3},{pace:'fast'},{count:8}]){const l=new League(store()),a=l.begin('quick','coda',{trackId:'puerto',count:4,laps:1,...args});const r=finish(l,a);assert.equal(r.credits,0);assert.equal(r.cards.length,0);}
 const l=new League(store()),a=l.begin('quick','coda');assert.equal(l.settle(a.id,{complete:true,lapTimes:[NaN]}),null);assert.equal(l.settle(a.id,{complete:false,lapTimes:[30]}),null);assert.equal(l.settle(a.id,{complete:true,lapTimes:[30,30]}),null);
});
test('tournament pays final only, entrants can lose and incomplete standings are rejected',()=>{
 const l=new League(store());finish(l,l.begin('club-open','coda'));finish(l,l.begin('club-open','coda'));assert.equal(l.state.credits,600);
 let a=l.begin('club-open','coda');assert.equal(l.state.credits,300);assert.throws(()=>l.settle(a.id,{complete:true,lapTimes:[30],position:4,racers:[]}));
 assert.equal(finish(l,a,4).credits,0);assert.equal(finish(l,l.begin('club-open','coda'),4).credits,0);
 const r=finish(l,l.begin('club-open','coda'),4);assert.equal(r.rank,4);assert.equal(r.net,-300);assert.equal(l.state.credits,300);assert.equal(l.state.run,null);
});
test('licenses grant bridge contracts, not automatic ownership, and never duplicate',()=>{
 const l=new League(store());const r=cup(l,'club','coda');assert.equal(r.contract,'apex');assert.equal(l.state.cards.apex,acquisition('apex').cards);assert(!l.owns('apex'));assert.equal(licenseTier(l.state),1);
 l.unlock('apex');assert(l.owns('apex'));assert.equal(cup(l,'club','coda').contract,null);
});
test('league access requires collection AND mastery; level costs/caps are real and immutable',()=>{
 const l=new League(store());assert.throws(()=>l.begin('duel-forest','coda'));
 l.transaction(s=>{s.owned.push('borough','kafer');s.mastery.club=40;s.cards.coda=8;});assert(l.state.opened.includes('forest'));
 l.upgrade('coda');assert.equal(l.level('coda'),2);assert.equal(l.state.credits,400);assert.equal(l.state.cards.coda,0);assert.throws(()=>l.upgrade('coda'));
 const v=VEHICLES[0],original=JSON.stringify(v),n5=upgradedVehicle(v,5,2);assert.equal(n5.economyLevel,2);assert.equal(n5.speed,v.speed);assert(n5.handling.engineForce>v.handling.engineForce);assert.equal(JSON.stringify(v),original);
 assert.equal(l.begin('duel-forest','coda').level,2);
});
test('max-level duplicates redirect within band; all-max reserve never becomes CR',()=>{
 const l=new League(store());l.transaction(s=>{s.levels.borough=5;const a=[];l.addCards(s,'borough',3,a);assert.equal(a[0].id,'coda');for(const id of groups.club)s.levels[id]=5;l.addCards(s,'borough',4,a);assert.equal(a[1].reserve,'series');});assert.equal(l.state.reserve.series,4);assert.equal(l.state.credits,600);
});
test('v1 active tournament preserves old prizes and source snapshot through migration',()=>{
 const st=store(),old=new Legacy(st);old.begin('club-open','coda');const original=st.getItem('prl.league.v1');const l=new League(st);assert(l.state.run.legacyRules);
 finish(l,l.begin('club-open','coda'));finish(l,l.begin('club-open','coda'));for(let i=0;i<3;i++)finish(l,l.begin('club-open','coda'),4);
 assert.equal(l.state.credits,990);assert.equal(l.state.run,null);assert.equal(st.getItem('prl.league.v1'),original);assert.equal(new League(st).state.credits,990);
});
test('stale tab cannot overwrite newer rewards; corrupt snapshot remains intact',()=>{
 const st=store(),a=new League(st),b=new League(st);quick(a);assert.throws(()=>quick(b),/otra pestaña/);assert.equal(new League(st).state.credits,740);
 st.setItem(LEAGUE_KEY,'{broken');const broken=new League(st);quick(broken);assert.equal(st.getItem(LEAGUE_KEY),'{broken');assert.equal(broken.saved,false);
});
test('storage failure remains playable and receipt reports same wallet as state',()=>{
 const l=new League({getItem(){return null;},setItem(){throw Error('full');}});const r=quick(l);assert.equal(l.saved,false);assert.equal(r.balanceAfter,l.state.credits);assert.equal(r.credits,140);
});
test('UI shows five destinations, closing controls and gross/net before charging',()=>{
 const league=new League(store()),args={league,options:{vehicleId:'coda'},tracks:playgroundTracks(),ready:true,step:'circuit'};
 const html=renderLeague(args);for(const name of ['Events','Career','Drive','Cars','Rankings'])assert(html.includes(name));
 const detail=renderLeague({...args,selection:'duel-club'});assert(detail.includes('Cerrar competición'));assert(detail.includes('100 CR'));assert(detail.includes('200 CR'));assert.equal(league.state.credits,600);
});
test('late leagues have an explicit free recovery path within five last-place finishes',()=>{
 const l=new League(store());l.transaction(s=>{s.opened=LEAGUES.map(l=>l.id);s.credits=0;});for(let i=0;i<5;i++)finish(l,l.begin('quick','coda',{trackId:'puerto',mode:'race',count:4,laps:1}),4);assert.equal(l.state.credits,4500);
});
test('upgrade changes real race handling and record signatures, including starter engine force',async()=>{
 const {RaceSession}=await import('../src/race.js'),{Circuit}=await import('../src/circuit.js'),{TRACKS}=await import('../src/config.js'),{resultContext}=await import('../src/results.js');
 const v=VEHICLES[0],circuit=new Circuit(TRACKS[0]),factory=upgradedVehicle(v,1),level2=upgradedVehicle(v,5,2);
 const r=new RaceSession(circuit,level2,{count:2,laps:1,vehiclePool:[level2]});assert.equal(r.rivals.length,1);for(const car of r.racers)assert.equal(car.drive.vehicle.economyLevel,2);
 const settings={track:TRACKS[0],surface:'track',weather:'clear',pace:'normal',mode:'race',raceRules:{count:2,laps:1,interaction:'ghost'}};
 assert.notEqual(resultContext({...settings,vehicle:factory},circuit).key,resultContext({...settings,vehicle:level2},circuit).key);
});
test('free recovery remains available during a paid event without losing or repaying entry',()=>{
 const l=new League(store());finish(l,l.begin('club-open','coda'));finish(l,l.begin('club-open','coda'));l.begin('club-open','coda');const wallet=l.state.credits;quick(l);assert.equal(l.state.run.eventId,'club-open');assert.equal(l.state.credits,wallet+140);l.begin('club-open','coda');assert.equal(l.state.credits,wallet+140);
});

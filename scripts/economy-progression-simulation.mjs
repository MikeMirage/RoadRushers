import {writeFileSync,mkdirSync} from 'node:fs';
import {League,LEAGUES,acquisition,EVENTS,licenseTier} from '../src/league.js';
import {VEHICLES} from '../src/config.js';
import {vehiclePowerClass} from '../src/vehicle-regulations.js';
let seed=20261102;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function simulate(p){
 const m=new Map(),l=new League({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)});let races=0,free=0;const milestones=[];
 const finish=(id,car,place=1)=>{const a=l.begin(id,car,{trackId:'puerto',mode:'race',count:4,laps:1}),field=Array.from({length:a.count-1},(_,i)=>({id:'rival-'+i,finishTime:31+i}));field.splice(place-1,0,{id:'player',isPlayer:true,finishTime:30.5+(place-1)});races++;return l.settle(a.id,{complete:true,lapTimes:Array(a.laps).fill(30),position:place,racers:field});};
 const recovery=()=>{free++;finish('quick','coda',4);};
 const runCup=(id,car)=>{for(const _ of EVENTS.find(e=>e.id===id).tracks)finish(id,car,2);};
 for(const target of LEAGUES.slice(1)){
  if(target.tier>=1&&licenseTier(l.state)<1){runCup('club','coda');if(!l.owns('apex'))l.unlock('apex');}
  if(target.tier>=2&&licenseTier(l.state)<2){runCup('sport','apex');if(!l.owns('c7-sport'))l.unlock('c7-sport');while(licenseTier(l.state)<2)recovery();}
  while(l.state.owned.length<target.owned){const next=VEHICLES.filter(v=>!l.owns(v.id)&&l.available(v.id)).sort((a,b)=>acquisition(a.id).cards-acquisition(b.id).cards)[0];if(!next)throw Error('Cyclic collection gate');l.setFocus(next.id);while((l.state.cards[next.id]||0)<acquisition(next.id).cards)recovery();l.unlock(next.id);}
  const prior=LEAGUES[target.index-1],car=l.state.owned.find(id=>vehiclePowerClass(VEHICLES.find(v=>v.id===id))===prior.category);
  while((l.state.mastery[prior.id]||0)<target.previousMastery){while(l.state.credits<prior.fee)recovery();finish('duel-'+prior.id,car,random()<p?1:2);if(races>10000)throw Error('Progression stalled');}
  if(!l.state.opened.includes(target.id))throw Error('Unreachable '+target.id);
  milestones.push({league:target.id,races,free,balance:l.state.credits});
 }
 return milestones;
}
const rows=[];for(const p of [.35,.5,.65]){const samples=Array.from({length:50},()=>simulate(p));for(let i=0;i<8;i++){const ordered=samples.map(s=>s[i].races).sort((a,b)=>a-b);rows.push({winRate:p,league:samples[0][i].league,racesP10:ordered[4],racesP50:ordered[24],racesP90:ordered[44],freeMean:Math.round(samples.reduce((n,s)=>n+s[i].free,0)/50)});}}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/economy-progression-simulation.json',JSON.stringify({policy:'50 seeds per rate; actual economy authority; target cheapest available cards; free last-place races for cards and solvency; cup podium assumed; no upgrades; no estimate of real player retention',rows},null,2));console.table(rows);

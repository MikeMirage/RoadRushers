import {groups,band} from './economy-catalog.js';
export {groups};
export const BALANCE_VERSION='local-2.0';
export const LEAGUES=[
 ['club','Club',2,0,100,2,0,'p1',['puerto','faro']],
 ['forest','Bosque',4,40,200,2,0,'p1',['world-woodland']],
 ['mediterranean','Mediterráneo',6,60,400,3,1,'p2',['world-amalfi']],
 ['desert','Desierto',8,80,700,3,1,'p2',['world-sahara']],
 ['winter','Invierno',10,100,1000,3,1,'p2',['world-norway']],
 ['pyrenees','Pirineos',12,120,1500,4,1,'p2',['world-pyrenees']],
 ['reunion','Reunión',15,140,2200,4,2,'p3',['world-reunion']],
 ['tokyo','Tokio',18,160,3200,5,2,'p3',['world-tokyo']],
 ['bund','Bund',22,180,4500,5,2,'p3',['world-bund']],
].map(([id,name,owned,previousMastery,fee,cap,tier,category,tracks],index)=>({id,name,owned,previousMastery,fee,cap,tier,category,tracks,index,masteryCap:[40,60,80,100,120,140,160,180,200][index]}));
export const leagueById=id=>LEAGUES.find(l=>l.id===id);
export const acquisition=id=>({band:band(id),cards:{series:10,special:20,icon:40}[band(id)],league:Object.keys(groups).find(l=>groups[l].includes(id))});
export const UPGRADE_CARDS=[8,16,30,50];
export const UPGRADE_COSTS={p1:[200,500,1200,2800],p2:[600,1500,3600,8400],p3:[1600,4000,9600,22400]};
export const FREE_TRACKS=['puerto','aserradero','faro','kit-club-v1','gp-suzuka-compact-v1','gp-silverstone-compact-v1','gp-interlagos-compact-v1','gp-spa-compact-v1','gp-monza-compact-v1','gp-austin-compact-v1'];
/** Never mutate factory catalogue. Caps apply equally to player and rivals. */
export function upgradedVehicle(vehicle,level=1,cap=5){
 const n=Math.max(1,Math.min(5,level,cap));
 const v={...vehicle,economyLevel:n,acceleration:vehicle.acceleration*(n>=2?1.015:1),speed:vehicle.speed,grip:vehicle.grip*(n>=4?1.015:1),response:vehicle.response*(n>=5?1.015:1)};
 if(vehicle.handling)v.handling={...vehicle.handling,engineForce:vehicle.handling.engineForce*(n>=2?1.015:1),steeringRate:vehicle.handling.steeringRate*(n>=5?1.015:1)};
 return v;
}

/** A completed recovery race funds at least one fifth of the highest open entry. */
export function freeRacePrizes(state){const highest=LEAGUES.filter(l=>state.opened.includes(l.id)).at(-1)||LEAGUES[0],base=Math.max(80,Math.ceil(highest.fee/50)*10);return [1.75,1.375,1.125,1].map(m=>Math.round(base*m));}

export const isFreeRaceEligible=o=>o.mode!=='practice'&&FREE_TRACKS.includes(o.trackId||'puerto')&&(o.laps||1)===1&&(o.count||4)===4&&(o.pace||'normal')==='normal'&&(o.width||'original')==='original'&&(o.surface||'track')==='track'&&(o.weather||'clear')==='clear';

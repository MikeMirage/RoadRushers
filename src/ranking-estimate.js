import { Circuit } from './circuit.js';
import { DriveModel } from './physics.js';
import { RaceProgress } from './race.js';
import { RaceGuide,RivalDriver } from './race-driver.js';
import { fingerprint } from './results.js';

const aliases=['NOVA','KITE','APEX','ROOK','MICA','VOLT','RIFT','SORA','DRIFT','COAST','ECHO','LYNX','PINE','TURBO','ZENO','RALLY','KAI','LUNA','COBRA','EMBER','NORTH','RUSH','CIRCUIT','HACHI','NERO'];
const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};

/** Real AI laps in free air, interpolated into fifty explicitly fictional references. */
export function estimateLeaderboard(context){
  const circuit=new Circuit(context.track);if(!circuit.closed)throw Error('Se necesita un circuito cerrado para estimar vueltas.');
  const random=seeded(parseInt(fingerprint(context.category),36)),guide=new RaceGuide(circuit),lapCount=Math.max(3,context.laps);
  const slot=Math.max(0,context.count-1),behind=context.mode==='race'?3+Math.floor(slot/2)*5.1+(slot%2)*.5:0;
  const u=((1-behind/circuit.length)%1+1)%1,lane=context.mode==='race'?Math.min(2.4,circuit.widthAt(u)*.23):0;
  const pilots=Array.from({length:9},(_,i)=>{
    const drive=new DriveModel(circuit,context.vehicle);drive.reset(circuit,u,lane);
    const driver=new RivalDriver(random,i,['expert','club','novice'][Math.floor(i/3)],guide);driver.reset(lane);
    return {id:`benchmark-${i}`,drive,driver,tracker:new RaceProgress(u,behind,circuit.length)};
  });
  const dt=1/120,budget=Math.min(1800,Math.max(120,circuit.length/3*lapCount));let elapsed=0;
  while(elapsed<budget&&pilots.some(p=>p.tracker.finishTime==null)){
    elapsed+=dt;
    for(const pilot of pilots){
      if(pilot.tracker.finishTime!=null)continue;
      const input=pilot.driver.decide(dt,pilot,[pilot],circuit,'ghost',context.surface,context.weather,context.pace);
      pilot.drive.step(dt,input.steer,context.surface,context.weather,context.pace,input.brake);
      pilot.tracker.step(dt,pilot.drive.road.progress,elapsed,lapCount);
    }
  }
  const samples=pilots.filter(p=>p.tracker.finishTime!=null).map(p=>({bestLap:Math.min(...p.tracker.lapTimes),totalTime:context.laps?p.tracker.lapTimes.slice(0,context.laps).reduce((s,t)=>s+t,0):null})).sort((a,b)=>a.bestLap-b.bestLap);
  if(samples.length<3)throw Error('No se ha podido completar la estimación de este circuito.');
  return Array.from({length:50},(_,i)=>{
    const q=i/49*(samples.length-1),a=samples[Math.floor(q)],b=samples[Math.min(samples.length-1,Math.floor(q)+1)],t=q%1,factor=1+(random()-.5)*.014;
    return {id:`ai-${i}`,name:`${aliases[i%aliases.length]}.${String(Math.floor(random()*900)+100)}`,bestLap:(a.bestLap+(b.bestLap-a.bestLap)*t)*factor,
      totalTime:a.totalTime==null?null:(a.totalTime+(b.totalTime-a.totalTime)*t)*factor,simulated:true};
  });
}

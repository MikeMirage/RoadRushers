import { DriveModel } from './physics.js';
import { Circuit } from './circuit.js';
import { RivalDriver,RaceGuide,aiLevel,gridLevels } from './race-driver.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const progressDelta=(a,b)=>{let d=a-b;if(d<-.5)d++;if(d>.5)d--;return d;};
const NAMES=['NOVA.7','Mika','HACHI','Río','VOLT','Luna','ApexKid','KAI_88','Cobalt','Sora','DRIFTY'];
const COLORS=['#327d9c','#c44a32','#61913b','#67579c','#ba8127','#ad446d','#357c68','#4166a6','#557482','#a97038','#b53d31'];
const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};

export function makeRaceTrack(base,width='original') {
  base=base.raceBaseConfig||base;
  const actual=width==='original'?base.width:Number(width);
  const config={...base,id:`${base.id}.grid-w${actual}`,width:actual,raceBaseId:base.id,raceBaseConfig:base};
  const circuit=new Circuit(config);
  let error=circuit.layout?.errors[0]||null,minWidth=Infinity,maxWidth=0;
  for(let i=0;i<circuit.count;i++){
    const u=i/circuit.count,w=circuit.widthAt(u);minWidth=Math.min(minWidth,w);maxWidth=Math.max(maxWidth,w);
    const a=circuit.at((i-1)/circuit.count),b=circuit.at((i+1)/circuit.count),angle=Math.abs(wrap(b.heading-a.heading));
    if(circuit.length*2/circuit.count/Math.max(angle,1e-7)<w/2+.7)error='Este ancho doblaría el borde interior de una curva. Elige uno menor.';
  }
  return {config,circuit,error,warnings:circuit.layout?.warnings||[],minWidth,maxWidth};
}

/** Ordered eighth-lap gates, starting behind the line on a real staggered grid. */
export class RaceProgress {
  constructor(raw,behind,length){this.previous=raw;this.absolute=-behind/length;this.nextGate=behind>0?0:1;this.completed=0;this.finishTime=null;this.wrongWay=false;this.lapTimes=[];this.lapStartedAt=0;}
  step(dt,raw,elapsed,laps){
    const delta=progressDelta(raw,this.previous);this.previous=raw;this.wrongWay=delta<-.00008;
    if(Math.abs(delta)>.04)return false;
    const before=this.absolute;this.absolute+=delta;
    if(delta<=0||this.finishTime!=null)return false;
    while(this.absolute>=this.nextGate/8&&before<this.nextGate/8){
      const gate=this.nextGate++;
      const crossing=elapsed-dt+dt*clamp((gate/8-before)/delta,0,1);
      if(gate>0&&gate%8===0){this.completed=gate/8;this.lapTimes.push(crossing-this.lapStartedAt);this.lapStartedAt=crossing;}
      if(gate===laps*8){this.finishTime=crossing;return true;}
    }
    return false;
  }
  lapNumber(total){return Math.min(total,this.completed+1);}
}


function capsule(car) {
  const width=car.vehicle.bodyWidth??(car.vehicle.design?car.vehicle.design.width*2:car.vehicle.id==='coda'?1.6:1.9);
  const length=car.vehicle.bodyLength??(car.vehicle.design?car.vehicle.design.halfLength*2:car.vehicle.id==='coda'?3:3.35);
  const radius=width/2,half=Math.max(.1,length/2-radius);
  const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
  return {x:car.x-fx*half,z:car.z-fz*half,dx:fx*half*2,dz:fz*half*2,radius};
}

/** Inelastic capsule contacts: no added bounce, and no contacts between bridge decks. */
export function resolveCarContacts(racers,circuit,iterations=3) {
  let contacts=0;
  for(let iteration=0;iteration<iterations;iteration++)for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++){
    const a=racers[i].drive,b=racers[j].drive;
    if(Math.abs(a.y-b.y)>1.4||Math.abs(a.x-b.x)>5||Math.abs(a.z-b.z)>5)continue;
    const p=capsule(a),q=capsule(b),rx=p.x-q.x,rz=p.z-q.z;
    const aa=p.dx*p.dx+p.dz*p.dz,ee=q.dx*q.dx+q.dz*q.dz,bb=p.dx*q.dx+p.dz*q.dz,cc=p.dx*rx+p.dz*rz,ff=q.dx*rx+q.dz*rz;
    const denom=aa*ee-bb*bb;let s=denom>1e-8?clamp((bb*ff-cc*ee)/denom,0,1):0,t=(bb*s+ff)/ee;
    if(t<0){t=0;s=clamp(-cc/aa,0,1);}else if(t>1){t=1;s=clamp((bb-cc)/aa,0,1);}
    let dx=p.x+p.dx*s-q.x-q.dx*t,dz=p.z+p.dz*s-q.z-q.dz*t,distance=Math.hypot(dx,dz);
    if(distance>=p.radius+q.radius)continue;
    if(distance<1e-6){dx=a.x-b.x;dz=a.z-b.z;distance=Math.hypot(dx,dz);if(distance<1e-6){dx=a.road.nx;dz=a.road.nz;distance=1;}}
    const nx=dx/distance,nz=dz/distance,penetration=p.radius+q.radius-Math.hypot(p.x+p.dx*s-q.x-q.dx*t,p.z+p.dz*s-q.z-q.dz*t);
    const correction=Math.min(.18,Math.max(0,penetration-.008)*.38);
    a.x+=nx*correction;a.z+=nz*correction;b.x-=nx*correction;b.z-=nz*correction;
    const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
    if(closing<0){const impulse=Math.min(8,-closing*.51);a.vx+=nx*impulse;a.vz+=nz*impulse;b.vx-=nx*impulse;b.vz-=nz*impulse;a.impact=Math.max(a.impact,Math.min(1,-closing/12));b.impact=Math.max(b.impact,Math.min(1,-closing/12));}
    contacts++;
    for(const car of [a,b]){
      car.road=circuit.nearest(car.x,car.z,{progress:car.road.progress,y:car.y});
      if(car.road.supported===false||car.activeGap&&car.y>car.road.y+1){car.speed=Math.hypot(car.vx,car.vz);continue;}
      const limit=circuit.widthAt(car.road.progress)/2-.7,offset=clamp(car.road.offset,-limit,limit);
      if(offset!==car.road.offset){car.x=car.road.x+car.road.nx*offset;car.z=car.road.z+car.road.nz*offset;car.road.offset=offset;}
      if(Math.abs(offset)>=limit-.002){const outward=(car.vx*car.road.nx+car.vz*car.road.nz)*Math.sign(offset);if(outward>0){car.vx-=car.road.nx*Math.sign(offset)*outward;car.vz-=car.road.nz*Math.sign(offset)*outward;}}
      if(car.grounded)car.y=car.road.y;
      car.speed=Math.hypot(car.vx,car.vz);
    }
  }
  return contacts;
}

export class RaceSession {
  constructor(circuit,vehicle,{count=12,interaction='ghost',laps=3,seed=38171,difficulty='club',fieldLevels='mixed',vehiclePool=[vehicle]}={}){
    if(!circuit.closed)throw new Error('La carrera requiere un circuito cerrado.');
    this.circuit=circuit;this.vehicle=vehicle;this.count=[4,8,12].includes(count)?count:12;
    this.interaction=interaction==='contact'?'contact':'ghost';this.lapCount=[1,3,5].includes(laps)?laps:3;this.seed=seed;
    this.difficulty=aiLevel(difficulty);this.fieldLevels=fieldLevels==='uniform'?'uniform':'mixed';
    const random=seeded(seed),guide=new RaceGuide(circuit),levels=gridLevels(this.count-1,this.difficulty,this.fieldLevels,random);
    const grid=raceGridVehicles(vehicle,{count:this.count,seed,vehiclePool});
    this.racers=Array.from({length:this.count},(_,index)=>{
      const isPlayer=index===this.count-1,controller=isPlayer?null:new RivalDriver(random,index,levels[index],guide);
      return {id:isPlayer?'player':`rival-${index}`,slot:index,isPlayer,name:isPlayer?'TÚ':NAMES[index],color:isPlayer?vehicle.color:COLORS[index],drive:new DriveModel(circuit,grid[index]),controller,level:isPlayer?null:levels[index]};
    });
    this.player=this.racers.at(-1);this.rivals=this.racers.slice(0,-1);this.reset();
  }
  reset(){
    this.elapsed=0;this.finishers=[];this.contacts=0;this.finished=false;
    for(const racer of this.racers){
      const behind=3+Math.floor(racer.slot/2)*5.1+(racer.slot%2)*.5,u=((1-behind/this.circuit.length)%1+1)%1;
      const lane=(racer.slot%2?1:-1)*Math.min(2.4,this.circuit.widthAt(u)*.23);
      racer.drive.reset(this.circuit,u,lane);racer.tracker=new RaceProgress(u,behind,this.circuit.length);racer.finishTime=null;racer.place=null;
      racer.controller?.reset(lane);
    }
  }
  step(dt,input,surface='track',weather='clear',pace='normal'){
    if(this.finished)return false;this.elapsed+=dt;
    const decisions=this.racers.map(r=>r.isPlayer?input:r.controller.decide(dt,r,this.racers,this.circuit,this.interaction,surface,weather,pace));
    this.racers.forEach((r,i)=>r.drive.step(dt,decisions[i].steer,surface,weather,pace,decisions[i].brake,decisions[i].throttle??1));
    if(this.interaction==='contact')this.contacts+=resolveCarContacts(this.racers,this.circuit);
    const arrivals=[];
    for(const r of this.racers){
      if(r.drive.respawned){r.tracker.absolute-=r.drive.recoveryRewind;r.tracker.previous=r.drive.road.progress;r.tracker.nextGate=Math.max(r.tracker.completed*8+1,Math.min(r.tracker.nextGate,Math.floor(r.tracker.absolute*8)+1));}
      if(r.tracker.step(dt,r.drive.road.progress,this.elapsed,this.lapCount)){r.finishTime=r.tracker.finishTime;arrivals.push(r);}
    }
    arrivals.sort((a,b)=>a.finishTime-b.finishTime||a.slot-b.slot);
    for(const r of arrivals){r.place=this.finishers.length+1;this.finishers.push(r);}
    if(this.player.finishTime!=null){this.finished=true;return true;}
    return false;
  }
  standings(){return [...this.racers].sort((a,b)=>a.place&&b.place?a.place-b.place:a.place?-1:b.place?1:b.tracker.absolute-a.tracker.absolute||a.slot-b.slot);}
  get position(){return this.player.place||this.standings().indexOf(this.player)+1;}
}

/** Use a separate seed stream so choosing a field never changes AI difficulty. */
export function raceGridVehicles(vehicle,{count=12,seed=38171,vehiclePool=[vehicle]}={}){
  const random=seeded(seed^0x52414345),pool=vehiclePool.length?vehiclePool:[vehicle],size=[4,8,12].includes(count)?count:12;
  return Array.from({length:size},(_,i)=>i===size-1?vehicle:pool[Math.floor(random()*pool.length)]);
}

import { SURFACES, WEATHER, PACES } from './config.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const delta=(a,b)=>wrap((a-b)*Math.PI*2)/(Math.PI*2);
const approach=(a,b,step)=>a+clamp(b-a,-step,step);

// These values affect decisions, never the car's physical capabilities.
export const AI_LEVELS={
  novice:{name:'Novato',reaction:.18,cornering:6.5,brakeMargin:15,precision:.88,passing:.7,defending:.28},
  club:{name:'Club',reaction:.12,cornering:17,brakeMargin:7,precision:1,passing:1,defending:.65},
  expert:{name:'Experto',reaction:.08,cornering:29,brakeMargin:3,precision:1.08,passing:1.25,defending:1},
};
export const aiLevel=id=>Object.hasOwn(AI_LEVELS,id)?id:'club';

export function gridLevels(count,difficulty,spread,random){
  const base=['novice','club','expert'].indexOf(aiLevel(difficulty));
  const levels=Array.from({length:count},(_,i)=>['novice','club','expert'][clamp(base+(spread==='uniform'?0:i%4===0?-1:i%4===3?1:0),0,2)]);
  for(let i=levels.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[levels[i],levels[j]]=[levels[j],levels[i]];}
  return levels;
}

/** Cached geometry shared by the grid. It contains no car state or shortcuts. */
export class RaceGuide {
  constructor(circuit){
    this.circuit=circuit;this.length=circuit.length;this.count=Math.max(240,Math.ceil(circuit.length/1.5));
    this.points=Array.from({length:this.count},(_,i)=>{
      const u=i/this.count,p=circuit.at(u),a=circuit.at(u-3/circuit.length),b=circuit.at(u+3/circuit.length);
      return {...p,width:circuit.widthAt(u),curvature:wrap(b.heading-a.heading)/6};
    });
  }
  at(u,offset=0){
    const f=((u%1+1)%1)*this.count,i=Math.floor(f),t=f-i,a=this.points[i%this.count],b=this.points[(i+1)%this.count];
    const heading=a.heading+wrap(b.heading-a.heading)*t,bank=a.bank+(b.bank-a.bank)*t;
    return {x:a.x+(b.x-a.x)*t+Math.cos(heading)*offset,z:a.z+(b.z-a.z)*t-Math.sin(heading)*offset,
      y:a.y+(b.y-a.y)*t+Math.tan(bank)*offset,heading,grade:a.grade+(b.grade-a.grade)*t,
      curvature:a.curvature+(b.curvature-a.curvature)*t,width:a.width+(b.width-a.width)*t};
  }
}

export function bodyWidth(car){return car.vehicle.bodyWidth??(car.vehicle.design?car.vehicle.design.width*2:car.vehicle.id==='coda'?1.6:1.9);}

export class RivalDriver {
  constructor(random,index,level,guide){
    this.level=aiLevel(level);this.profile=AI_LEVELS[this.level];this.guide=guide;
    this.interval=this.profile.reaction*(.94+random()*.12);this.confidence=.96+random()*.08;
    this.bias=(index%2?1:-1)*(.18+random()*.28);this.personality=random();
    this.reset(0);
  }
  reset(lane){
    this.timer=0;this.lane=lane;this.targetLane=lane;this.steerTarget=0;this.speedTarget=Infinity;this.braking=false;this.brakeTime=0;
    this.input={steer:0,brake:false};this.maneuver='cruise';this.maneuverTime=0;this.opponent=null;this.defendedAgainst=null;
  }
  traffic(racer,field){
    const car=racer.drive;
    return field.filter(other=>other!==racer&&Math.abs(other.drive.y-car.y)<1.4).map(other=>({
      racer:other,gap:delta(other.drive.road.progress,car.road.progress)*this.guide.length,
      offset:other.drive.road.offset,speed:other.drive.vx*other.drive.road.tx+other.drive.vz*other.drive.road.tz,
      lateral:other.drive.vx*other.drive.road.nx+other.drive.vz*other.drive.road.nz,width:bodyWidth(other.drive),
    })).filter(t=>t.gap>-25&&t.gap<40);
  }
  clearLane(lane,traffic,car,ignore){
    const clearance=bodyWidth(car)/2;
    return !traffic.some(t=>t.racer!==ignore&&[0,.55,1.1].some(seconds=>
      Math.abs(lane-t.offset-t.lateral*seconds)<clearance+t.width/2+.55&&Math.abs(t.gap+(t.speed-car.speed)*seconds)<5));
  }
  plan(racer,field,circuit,interaction,surface,weather,pace){
    const car=racer.drive,u=car.road.progress,v=car.speed,p=this.profile;
    const near=this.guide.at(u),look=this.guide.at(u+(8+v*.6)/circuit.length);
    let limit=near.width/2-bodyWidth(car)/2-.65;
    for(const d of [6,12,20])limit=Math.min(limit,this.guide.at(u+d/circuit.length).width/2-bodyWidth(car)/2-.65);
    limit=Math.max(.3,limit);
    const preferred=clamp(this.bias+Math.tanh(look.curvature*24)*Math.min(1,limit*.28),-limit,limit);
    const traffic=interaction==='contact'?this.traffic(racer,field):[];
    const front=traffic.filter(t=>t.gap>0&&t.gap<38&&Math.abs(t.offset-car.road.offset)<(t.width+bodyWidth(car))/2+.55).sort((a,b)=>a.gap-b.gap)[0];
    const behind=traffic.filter(t=>t.gap< -4.8&&t.gap> -16&&t.speed>v+.35).sort((a,b)=>b.gap-a.gap)[0];
    const opponent=traffic.find(t=>t.racer.id===this.opponent);
    if(this.maneuver==='pass'&&(!opponent||opponent.gap< -6||this.maneuverTime>6))this.maneuver='cruise';
    if(this.maneuver==='defend'&&this.maneuverTime>2.8&&(!opponent||opponent.gap< -17||opponent.gap>5))this.maneuver='cruise';
    if(this.defendedAgainst&&!traffic.some(t=>t.racer.id===this.defendedAgainst&&t.gap>-24&&t.gap<5))this.defendedAgainst=null;
    if(this.maneuver==='cruise'){
      this.targetLane=preferred;
      if(front&&front.gap<12+6*p.passing+Math.max(0,v-front.speed)*1.5&&(v>front.speed+.25||front.speed<14)){
        const separation=(bodyWidth(car)+front.width)/2+.8;
        const choices=[front.offset-separation,front.offset+separation].filter(lane=>Math.abs(lane)<=limit&&this.clearLane(lane,traffic,car,front.racer));
        choices.sort((a,b)=>Math.abs(a-car.road.offset)+Math.abs(a-preferred)*.4-Math.abs(b-car.road.offset)-Math.abs(b-preferred)*.4);
        if(choices.length){this.maneuver='pass';this.targetLane=choices[0];this.opponent=front.racer.id;this.maneuverTime=0;}
      }else if(behind&&this.defendedAgainst!==behind.racer.id&&this.personality<p.defending&&Math.abs(near.curvature)<.045){
        // One early move per attack. Hold the lane once a car draws alongside.
        const defend=clamp(Math.abs(look.curvature)>.012?Math.sign(look.curvature)*limit*.58:behind.offset,-limit,limit);
        if(this.clearLane(defend,traffic,car,behind.racer)){
          this.maneuver='defend';this.targetLane=defend;this.opponent=behind.racer.id;this.defendedAgainst=behind.racer.id;this.maneuverTime=0;
        }
      }
    }
    this.targetLane=clamp(this.targetLane,-limit,limit);
    // Never keep moving across a car that is already alongside.
    const overlap=traffic.find(t=>Math.abs(t.gap)<4.5&&Math.abs(t.offset-car.road.offset)<(t.width+bodyWidth(car))/2+.65&&
      (this.targetLane-car.road.offset)*(t.offset-car.road.offset)>0);
    if(overlap)this.targetLane=clamp(car.road.offset,-limit,limit);

    let speedLimit=Infinity;
    for(let d=0;d<=48;d+=4){
      const q=this.guide.at(u+d/circuit.length),surfaceId=circuit.surfaceAt(u+d/circuit.length,surface),s=SURFACES[surfaceId];
      const loose=['dirt','gravel'].includes(surfaceId)?car.vehicle.looseGrip:1;
      const grip=clamp(s.grip/9.5*car.vehicle.grip*loose,.18,1.2)*WEATHER[weather].grip;
      let cornerSpeed=Math.sqrt(p.cornering*this.confidence*grip/Math.max(.002,Math.abs(q.curvature)));
      if(Math.abs(q.grade)>.22)cornerSpeed=Math.min(cornerSpeed,15+p.precision*2);
      const cruise=s.speed*PACES[pace].speed*car.vehicle.speed;
      const safe=Math.min(cruise,cornerSpeed),brakingDistance=Math.max(0,d-p.brakeMargin-v*.18);
      speedLimit=Math.min(speedLimit,Math.sqrt(safe*safe+2*7*grip*brakingDistance));
    }
    let hazard=false;
    for(const t of traffic){
      const clearance=(bodyWidth(car)+t.width)/2+.45;
      if(t.gap>0&&Math.abs(t.offset-car.road.offset)<clearance&&(Math.abs(this.lane-t.offset)<clearance||t.gap<6)){
        const gap=Math.max(0,t.gap-5-v*.22),deceleration=5*WEATHER[weather].grip;
        speedLimit=Math.min(speedLimit,Math.sqrt(Math.max(0,t.speed)**2+2*deceleration*gap),Math.max(0,t.speed+(t.gap-4.6)*1.2));
        if(t.gap<4.8&&v>t.speed+.8)hazard=true;
      }
    }
    this.speedTarget=speedLimit;
    const aim=this.guide.at(u+(4.5+v*.36)/circuit.length,this.lane);
    const angle=Math.atan2(aim.x-car.x,aim.z-car.z),error=wrap(angle-car.heading);
    const s=SURFACES[circuit.surfaceAt(u,surface)],loose=['dirt','gravel'].includes(circuit.surfaceAt(u,surface))?car.vehicle.looseGrip:1;
    const grip=Math.max(.65,s.grip*car.vehicle.grip*loose*(1-car.drift*car.vehicle.drift))*WEATHER[weather].grip;
    const curvature=(near.curvature+aim.curvature)*.5;
    const noseLead=Math.atan(v*curvature/Math.max(1,grip));
    const yawFeed=curvature*v;
    const desiredYaw=yawFeed+wrap(error+noseLead)*2.5-(car.angularSpeed-yawFeed)*.7;
    const turn=2.65*car.vehicle.turn*Math.max(.4,Math.min(1,v/7))*(circuit.surfaceAt(u,surface)==='ice'?.85:1)*(car.grounded?1:.25);
    this.steerTarget=clamp(-desiredYaw/turn,-1,1);
    // Braking shares the player's interlock: both directions straighten the wheels.
    const aligned=Math.abs(error)<.24&&Math.abs(car.angularSpeed)<.7;
    if(this.braking){if(this.brakeTime>.24&&(v<Math.max(.25,speedLimit-.65)||Math.abs(error)>.28||Math.abs(car.angularSpeed)>1))this.braking=false;}
    else if(v>speedLimit+.7&&(aligned||hazard)){this.braking=true;this.brakeTime=0;}
  }
  decide(dt,racer,field,circuit,interaction,surface,weather,pace='normal'){
    this.timer-=dt;this.maneuverTime+=dt;this.brakeTime+=dt;
    if(this.timer<=0){this.timer+=this.interval;this.plan(racer,field,circuit,interaction,surface,weather,pace);}
    const laneRate=this.maneuver==='cruise'?.8:1.35;
    this.lane=approach(this.lane,this.targetLane,laneRate*dt);
    // Bound wheel demand changes every physics tick, not just every AI decision.
    this.input.steer=approach(this.input.steer,this.braking?0:this.steerTarget,2.1*dt);
    this.input.brake=this.braking;
    return this.input;
  }
}

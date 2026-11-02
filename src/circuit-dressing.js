/** Offline, deterministic circuit dressing. Only the resolved recipe is used at load time. */
export const DRESSING_VERSION=2;
export const DRESSING_LIMITS={segments:6000,tires:144,boards:48};
export function dressingSourceKey(config){
  const text=JSON.stringify([config.layout||null,config.points||null,config.width,config.widthProfile||null,config.startHeight||0,config.cornerSmoothing||0]);
  let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return (hash>>>0).toString(16);
}
const round=n=>Math.round(n*1e5)/1e5;
const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

/** Spatial corridor index: includes every supported branch, with independent vertical clearance. */
export function corridorIndex(circuit){
  const cells=new Map(),size=20,n=Math.ceil(circuit.length/2);
  for(let i=0;i<n;i++){
    const u=(i+.5)/n;if(!circuit.hasRoad(u))continue;
    const a=circuit.at(i/n),b=circuit.at((i+1)/n),half=Math.max(circuit.widthAt(i/n),circuit.widthAt((i+1)/n))/2;
    const s={a,b,half};
    for(let x=Math.floor((Math.min(a.x,b.x)-half)/size);x<=Math.floor((Math.max(a.x,b.x)+half)/size);x++)
      for(let z=Math.floor((Math.min(a.z,b.z)-half)/size);z<=Math.floor((Math.max(a.z,b.z)+half)/size);z++){
        const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);
      }
  }
  return (p,radius=0,height=.2)=>{
    const seen=new Set();
    for(let x=Math.floor((p.x-radius)/size);x<=Math.floor((p.x+radius)/size);x++)for(let z=Math.floor((p.z-radius)/size);z<=Math.floor((p.z+radius)/size);z++)for(const s of cells.get(`${x},${z}`)||[]){
      if(seen.has(s))continue;seen.add(s);
      const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/Math.max(.0001,dx*dx+dz*dz)));
      const y=s.a.y+(s.b.y-s.a.y)*t;
      if(p.y+height<y-.7||p.y>y+3)continue;
      if(Math.hypot(p.x-s.a.x-dx*t,p.z-s.a.z-dz*t)<s.half+radius+.25)return false;
    }
    return true;
  };
}
export function generateCircuitDressing(circuit,options){
  const clear=corridorIndex(circuit),segments=[],tireRuns=[],boards=[];
  const n=Math.min(DRESSING_LIMITS.segments/2,Math.ceil(circuit.length/3));
  let lastBoard=-100;
  for(let i=0;i<n;i++){
    const from=i/n,to=(i+1)/n,u=(from+to)/2,p=circuit.at(u),distance=u*circuit.length;
    if(![from,u,to].every(v=>circuit.hasRoad(v)))continue;
    const section=circuit.layout?.sections[circuit.curve.frame(u).section];
    if(section?.spec.tunnel||section?.spec.kind==='tunnel')continue;
    const curvature=turn(circuit.at(u-3/circuit.length).heading,circuit.at(u+3/circuit.length).heading)/6;
    const curved=Math.abs(curvature)>.007,outer=curvature>0?-1:1;
    const grounded=Math.abs(p.y)<.3&&Math.abs(p.bank)<.045&&Math.abs(p.pitch)<.035;
    for(const side of [-1,1]){
      // Broad margins only on flat ground. Elevated decks keep their existing structure.
      if(!grounded)continue;
      let width=curved&&side===outer?3:3.2;
      const safe=w=>[from,u,to].every(v=>[.65,w/2,w].every(d=>clear(circuit.at(v,side*(circuit.widthAt(v)/2+d)),.15)));
      while(width>1&&!safe(width))width-=.8;
      if(width<=1)continue;
      segments.push([round(from),round(to),side,round(width),curved?1:0,curved&&side===outer?1:0]);
      if(curved&&side===outer){
        const previous=tireRuns.at(-1);
        if(previous&&previous.side===side&&from-previous.to<.00002)previous.to=to;
        else tireRuns.push({from,to,side});
      }
      if(!curved&&distance-lastBoard>Math.max(32,circuit.length/36)&&boards.length<DRESSING_LIMITS.boards){
        const offset=side*(circuit.widthAt(u)/2+width-.3),q=circuit.at(u,offset);q.y=0;
        if(clear(q,2.6,1.6)){boards.push([round(u),round(offset)]);lastBoard=distance;}
      }
    }
  }
  // Short continuous walls at curve exteriors, close to the retained curbs.
  // Allocate complete walls around the whole lap rather than truncating midway.
  const runs=tireRuns.filter(r=>(r.to-r.from)*circuit.length>=5);
  const chosen=runs.length>18?Array.from({length:18},(_,i)=>runs[Math.floor(i*runs.length/18)]):runs;
  const tires=[],perWall=Math.min(10,Math.floor(DRESSING_LIMITS.tires/Math.max(1,chosen.length)));
  for(const run of chosen){
    const center=(run.from+run.to)/2,count=Math.min(perWall,Math.floor((run.to-run.from)*circuit.length/.98));
    const wall=[];
    for(let j=0;j<count;j++){
      const u=center+(j-(count-1)/2)*.98/circuit.length,offset=run.side*(circuit.widthAt(u)/2+1.65),p=circuit.at(u,offset);
      if(circuit.hasRoad(u)&&Math.abs(p.y)<.4&&clear(p,.54,1.05))wall.push([round(u),round(offset)]);
    }
    if(wall.length>=3)tires.push(...wall);
  }
  return addCircuitInfrastructure(circuit,{version:DRESSING_VERSION,preset:'club-circuit',sourceKey:dressingSourceKey(circuit.config),segments,tires,boards},options);
}
export function normalizeCircuitDressing(value){
  if(value==null||value.version===1)return undefined; // The first experimental layout must be regenerated.
  if(value.version!==DRESSING_VERSION||value.preset!=='club-circuit'||!/^\w{1,16}$/.test(value.sourceKey||''))throw Error('Preset de circuito incompatible.');
  const read=(name,length,valid)=>{
    const rows=value[name];if(!Array.isArray(rows)||rows.length>DRESSING_LIMITS[name])throw Error('El entorno supera el presupuesto de objetos.');
    return rows.map(row=>{if(!Array.isArray(row)||row.length!==length||!row.every(Number.isFinite)||!valid(row))throw Error('Datos de entorno no válidos.');return [...row];});
  };
  const segments=read('segments',6,r=>r[0]>=0&&r[1]>r[0]&&r[1]<=1&&[-1,1].includes(r[2])&&r[3]>=1&&r[3]<=6&&[0,1].includes(r[4])&&[0,1].includes(r[5]));
  // Prevent imported overlapping strips from multiplying geometry without bound.
  if(segments.reduce((sum,r)=>sum+r[1]-r[0],0)>2.02)throw Error('Demasiadas franjas superpuestas en el entorno.');
  const placement=r=>r[0]>=0&&r[0]<=1&&Math.abs(r[1])<=30;
  const extra={};
  if(value.markers){
    extra.markers={};
    for(const [kind,limit,len]of [['braking',48,4],['start',2,2],['grid',8,2]]){
      const rows=value.markers[kind];if(!Array.isArray(rows)||rows.length>limit)throw Error('Señalización fuera de presupuesto.');
      extra.markers[kind]=rows.map(r=>{if(!Array.isArray(r)||r.length!==len||!r.every(Number.isFinite)||r[0]<0||r[0]>1||Math.abs(r[1])>30||(len===4&&(![10,20,30,50,100,150].includes(r[2])||r[3]<0||r[3]>1)))throw Error('Señalización no válida.');return [...r];});
    }
  }
  if(value.infrastructure){
    extra.options=normalizeDressingOptions(value.options);extra.infrastructure={};
    for(const [kind,limit,len]of [['rails',1200,3],['fences',800,3],['ads',96,4]]){
      const rows=value.infrastructure[kind];
      if(!Array.isArray(rows)||rows.length>limit)throw Error('Infraestructura fuera de presupuesto.');
      let coverage=0;
      extra.infrastructure[kind]=rows.map(r=>{if(!Array.isArray(r)||r.length!==len||!r.every(Number.isFinite)||r[0]<0||r[1]<=r[0]||r[1]>1||![-1,1].includes(r[2])||(len===4&&![3.8,4.5].includes(r[3])))throw Error('Infraestructura no válida.');coverage+=r[1]-r[0];return [...r];});
      if(coverage>2.02)throw Error('Infraestructura superpuesta.');
    }
  }
  return {version:DRESSING_VERSION,preset:'club-circuit',sourceKey:value.sourceKey,segments,tires:read('tires',2,placement),boards:read('boards',2,placement),...extra};
}
export function activeCircuitDressing(circuit){
  const d=circuit.config.circuitDressing;
  return d?.version===DRESSING_VERSION&&d.sourceKey===dressingSourceKey(circuit.config)?d:null;
}

export const DEFAULT_DRESSING_OPTIONS={rails:true,railDensity:.65,fences:true,fenceDensity:.35,advertising:true,advertisingDensity:.65};
export function normalizeDressingOptions(input={}){
  const result={...DEFAULT_DRESSING_OPTIONS};
  for(const key of ['rails','fences','advertising'])if(typeof input[key]==='boolean')result[key]=input[key];
  for(const key of ['railDensity','fenceDensity','advertisingDensity'])if(Number.isFinite(input[key]))result[key]=Math.max(0,Math.min(1,input[key]));
  return result;
}
/** Add infrastructure without moving any existing margins or tire walls. */
export function addCircuitInfrastructure(circuit,recipe,input){
  const options=normalizeDressingOptions(input),clear=corridorIndex(circuit),rails=[],fences=[],ads=[];
  const pick=(u,side,density,salt)=>((Math.imul(Math.floor(u*circuit.length/24)+salt+(side+1)*113,2654435761)>>>0)%1000)/1000<density;
  for(const [a,b,side] of recipe.segments){
    const u=(a+b)/2;
    // Test the complete envelope, including neighbouring branches and overhead decks.
    const safe=(offset,height)=>[a,u,b].every(v=>clear(circuit.at(v,side*(circuit.widthAt(v)/2+offset)),.4,height));
    const rail=options.rails&&pick(u,side,options.railDensity,19)&&safe(3.8,1);
    const fence=options.fences&&pick(u,side,options.fenceDensity,37)&&safe(4.5,2.7);
    if(rail&&rails.length<1200)rails.push([a,b,side]);
    if(fence&&fences.length<800)fences.push([a,b,side]);
    if(options.advertising&&(rail||fence)&&pick(u,side,options.advertisingDensity,71)&&safe(fence?4.5:3.8,2.4))ads.push([a,b,side,fence?4.5:3.8]);
  }
  const selectedAds=ads.length>96?Array.from({length:96},(_,i)=>ads[Math.floor(i*ads.length/96)]):ads;
  return {...recipe,options,infrastructure:{rails,fences,ads:selectedAds},markers:recipe.markers||generateCircuitMarkers(circuit,recipe)};
}

/** Distances are measured along the track to the beginning of a tight bend. */
export function generateCircuitMarkers(circuit,recipe){
  const clear=corridorIndex(circuit),braking=[],grid=[],start=[];
  const curvature=u=>turn(circuit.at(u-3/circuit.length).heading,circuit.at(u+3/circuit.length).heading)/6;
  const usable=u=>{const p=circuit.at(u),section=circuit.layout?.sections[circuit.curve.frame(u).section];return circuit.hasRoad(u)&&Math.abs(p.y)<.3&&Math.abs(p.bank)<.06&&section?.spec.kind!=='tunnel'&&!section?.spec.tunnel;};
  const safe=(u,offset,radius,height)=>{
    if(!usable(u))return false;const p=circuit.at(u,offset);
    if(!clear(p,radius,height))return false;
    return recipe.tires.every(([v,o])=>{const t=circuit.at(v,o);return Math.hypot(p.x-t.x,p.z-t.z)>radius+.65;});
  };
  let last=-200;
  for(let d=3;d<circuit.length;d+=3){
    const u=d/circuit.length,k=curvature(u);
    if(Math.abs(k)<.015||Math.abs(curvature(u-3/circuit.length))>=.015||d-last<35)continue;
    let approach=0;for(let m=6;m<=200;m+=2){const v=(d-m)/circuit.length;if((!circuit.closed&&v<0)||!usable(v)||Math.abs(curvature(v))>.01)break;approach=m;}
    const side=k>0?-1:1;
    for(const meters of approach>=60?[150,100,50]:[30,20,10]){
      if(meters>approach-3||braking.length>=48)continue;
      const v=((d-meters)/circuit.length+1)%1,offset=side*(circuit.widthAt(v)/2+2.65);
      if(safe(v,offset,.8,2))braking.push([round(v),round(offset),meters,round(u)]);
    }
    last=d;
  }
  // Retain the existing chequered finish stripe; add roadside pylons and grid brackets only.
  for(const side of [-1,1]){const offset=side*(circuit.widthAt(0)/2+2.65);if(safe(0,offset,.85,2.8))start.push([0,round(offset)]);}
  for(let row=0;row<4;row++)for(const side of [-1,1]){
    const distance=8+row*6+(side>0?3:0);if(distance>circuit.length*.2)continue;
    const u=(1-distance/circuit.length)%1;if(usable(u)&&Math.abs(curvature(u))<.01)grid.push([round(u),round(side*circuit.widthAt(u)*.22)]);
  }
  return {braking,start,grid};
}

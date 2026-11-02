import {corridorIndex} from './circuit-dressing.js';
export const FACILITY_LIMITS={marshals:12,turnSigns:32,bridgeRails:1200};
const round=n=>Math.round(n*1e5)/1e5;
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const wrap=u=>(u%1+1)%1;
export function generateCircuitFacilities(circuit,recipe){
  const clear=corridorIndex(circuit),marshals=[],turnSigns=[],bridgeRails=[],reserved=[];
  const frame=u=>{const p=circuit.at(u);const s=circuit.layout?.sections[circuit.curve.frame(wrap(u)).section]?.spec;return {...p,tunnel:s?.kind==='tunnel'||s?.tunnel};};
  const occupied=[...(circuit.config.manualProps||[]).map(p=>({x:p.position[0],z:p.position[2],radius:2*(p.scale||1)})),...recipe.tires.map(([u,o])=>({...circuit.at(u,o),radius:.6})),...(recipe.markers?.braking||[]).map(([u,o])=>({...circuit.at(u,o),radius:.85})),...(recipe.markers?.start||[]).map(([u,o])=>({...circuit.at(u,o),radius:.9})),...recipe.boards.map(([u,o])=>({...circuit.at(u,o),radius:2.6}))];
  const site=(u,offset,radius,height)=>{
    const p=circuit.at(u,offset),center=frame(u);if(center.tunnel||!circuit.hasRoad(u)||Math.abs(p.y)>.2||Math.abs(p.bank)>.035||Math.abs(p.pitch)>.035||!clear(p,radius,height))return null;
    if([...occupied,...reserved].some(q=>Math.hypot(q.x-p.x,q.z-p.z)<radius+q.radius+.4))return null;
    return p;
  };
  function visibleFrom(p,u){
    const target=circuit.at(u-18/circuit.length);if(Math.hypot(target.x-p.x,target.z-p.z)>65)return false;
    for(let i=1;i<8;i++){
      const t=i/8,x=p.x+(target.x-p.x)*t,z=p.z+(target.z-p.z)*t,y=p.y+3+(target.y+.8-p.y-3)*t;
      const other=circuit.nearest(x,z,{exclude:wrap(u-9/circuit.length),window:32/circuit.length,y});
      if(other.distance<circuit.widthAt(other.progress)/2+.5&&Math.abs(other.y-y)<1) return false;
    }
    return true;
  }
  let lastCurve=-100,lastMarshal=-100;
  const step=Math.max(2,circuit.length/3000);
  for(let d=step;d<circuit.length;d+=step){
    const u=d/circuit.length,p=frame(u),previous=frame(u-4/circuit.length),next=frame(u+4/circuit.length);
    if(p.tunnel||![u-2/circuit.length,u,u+2/circuit.length].every(v=>circuit.hasRoad(v)))continue;
    const k=delta(previous.heading,next.heading)/8;
    const crest=previous.pitch>.045&&next.pitch<-.025;
    const before=delta(frame(u-8/circuit.length).heading,previous.heading)/4;
    if(((Math.abs(k)>.017&&Math.abs(before)<=.017)||crest)&&d-lastCurve>40){
      const target=wrap(u),at=wrap(u-12/circuit.length),outer=k>0?-1:1;
      for(const side of [outer,-outer]){
        const offset=side*(circuit.widthAt(at)/2+2.65),s=site(at,offset,.8,2.3);
        if(s&&turnSigns.length<FACILITY_LIMITS.turnSigns){turnSigns.push([round(at),round(offset),crest?0:(k>0?1:-1),round(target)]);reserved.push({...s,radius:.8});break;}
      }
      if(d-lastMarshal>80&&marshals.length<FACILITY_LIMITS.marshals)for(const side of [-outer,outer]){
        const offset=side*(circuit.widthAt(u)/2+8),s=site(u,offset,2.5,3.7);
        if(s&&visibleFrom(s,u)){marshals.push([round(u),round(offset)]);reserved.push({...s,radius:2.5});lastMarshal=d;break;}
      }
      lastCurve=d;
    }
    if(p.y<1.2)continue;
    const a=(d-step)/circuit.length,b=u;
    for(const side of [-1,1]){
      if(bridgeRails.length>=FACILITY_LIMITS.bridgeRails)break;
      const safe=[a,(a+b)/2,b].every(v=>{const q=frame(v);return !q.tunnel&&q.y>=1&&circuit.hasRoad(v)&&clear(circuit.at(v,side*(circuit.widthAt(v)/2+.72)),.18,1.2);});
      if(safe)bridgeRails.push([round(a),round(b),side]);
    }
  }
  return {marshals,turnSigns,bridgeRails};
}
export function normalizeCircuitFacilities(value){
  if(value==null)return undefined;const result={};
  for(const [key,len]of [['marshals',2],['turnSigns',4],['bridgeRails',3]]){
    if(!Array.isArray(value[key])||value[key].length>FACILITY_LIMITS[key])throw Error('Equipamiento de circuito fuera de presupuesto.');
    let coverage=0;
    result[key]=value[key].map(r=>{
      if(!Array.isArray(r)||r.length!==len||!r.every(Number.isFinite)||r[0]<0||r[0]>1)throw Error('Equipamiento no válido.');
      if(key==='bridgeRails'){if(r[1]<=r[0]||r[1]>1||![-1,1].includes(r[2]))throw Error('Protección de puente no válida.');coverage+=r[1]-r[0];}
      else if(Math.abs(r[1])>30||(key==='turnSigns'&&(![-1,0,1].includes(r[2])||r[3]<0||r[3]>1)))throw Error('Señal o puesto no válido.');
      return [...r];
    });if(coverage>2.02)throw Error('Protecciones superpuestas.');
  }
  return result;
}

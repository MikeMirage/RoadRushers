import {corridorIndex} from './circuit-dressing.js';
export const ADVERTISING_SHAPE={height:4,halfBase:2.3,standoff:.5};
export const advertisingCenter=offset=>offset+ADVERTISING_SHAPE.halfBase+ADVERTISING_SHAPE.standoff;
/** Reject the complete sign AND the adjacent road corridor beneath any upper deck. */
export function advertisingSite(circuit,recipe={}){
  const clear=corridorIndex(circuit),cells=new Map(),size=24;
  for(let i=0;i<circuit.count;i++){
    const u=(i+.5)/circuit.count;if(!circuit.hasRoad(u))continue;
    const a=circuit.samples[i],b=circuit.samples[i+1],half=circuit.widthAt(u)/2+1;
    for(let x=Math.floor((Math.min(a.x,b.x)-half)/size);x<=Math.floor((Math.max(a.x,b.x)+half)/size);x++)for(let z=Math.floor((Math.min(a.z,b.z)-half)/size);z<=Math.floor((Math.max(a.z,b.z)+half)/size);z++){
      const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push({a,b,half});
    }
  }
  const covered=p=>{
    for(const {a,b,half}of cells.get(`${Math.floor(p.x/size)},${Math.floor(p.z/size)}`)||[]){
      const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/Math.max(.001,dx*dx+dz*dz)));
      if(a.y+(b.y-a.y)*t>p.y+.8&&Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)<half)return true;
    }
    return false;
  };
  return (a,b,side,offset)=>{
    const steps=Math.max(2,Math.ceil((b-a)*circuit.length));
    for(let i=0;i<=steps;i++){
      const u=a+(b-a)*i/steps,p=circuit.at(u),half=circuit.widthAt(u)/2;
      const section=circuit.layout?.sections[circuit.curve.frame(u).section]?.spec;
      const heading=circuit.at(u+2/circuit.length).heading-circuit.at(u-2/circuit.length).heading;
      if(!circuit.hasRoad(u)||section?.kind==='tunnel'||section?.tunnel||Math.abs(p.y)>.3||Math.abs(p.pitch)>.04||Math.abs(p.bank)>.05||Math.abs(Math.atan2(Math.sin(heading),Math.cos(heading)))>.065)return false;
      const center=advertisingCenter(offset);
      for(const lateral of [center-ADVERTISING_SHAPE.halfBase,center,center+ADVERTISING_SHAPE.halfBase]){
        const sign=circuit.at(u,side*(half+lateral));if(!clear(sign,.4,ADVERTISING_SHAPE.height+.2)||covered(sign))return false;
        for(const [v,o]of recipe.facilities?.marshals||[]){const p=circuit.at(v,o);if(Math.hypot(p.x-sign.x,p.z-sign.z)<2.9)return false;}
        for(const prop of circuit.config.manualProps||[])if(Math.hypot(prop.position[0]-sign.x,prop.position[2]-sign.z)<2*(prop.scale||1)+.4)return false;
      }
      for(const lateral of [-half,0,half,side*(half+offset)])if(covered(circuit.at(u,lateral)))return false;
    }
    return true;
  };
}
export function advertisingAvoidsSigns(circuit,[a,b,side],recipe={}){
  const markers=[...(recipe.markers?.braking||[]),...(recipe.markers?.start||[]),...(recipe.facilities?.turnSigns||[])];
  return markers.every(([u,offset])=>{let distance=Math.abs(u-(a+b)/2);if(circuit.closed)distance=Math.min(distance,1-distance);return Math.sign(offset)!==side||distance*circuit.length>(b-a)*circuit.length/2+4;});
}
export function generateCircuitAdvertising(circuit,rails,fences,options,recipe){
  if(!options.advertising||!options.advertisingDensity)return [];
  const valid=advertisingSite(circuit,recipe),runs=[],ads=[];
  // Long panels on continuous supports, with large gaps between sponsorship groups.
  for(const [rows,offset]of [[fences,4.5],[rails,3.8]])for(const side of [-1,1]){
    let run=null;
    for(const [a,b,s]of rows.filter(r=>r[2]===side).sort((a,b)=>a[0]-b[0])){
      if(run&&Math.abs(a-run[1])<.00002)run[1]=b;
      else{run=[a,b,s,offset];runs.push(run);}
    }
  }
  const used=[];
  for(const [from,to,side,offset]of runs){
    const meters=(to-from)*circuit.length;if(meters<6)continue;
    for(let d=0;d+6<=meters&&ads.length<32;d+=22){
      const a=from+d/circuit.length,b=a+6/circuit.length,mid=(a+b)/2;
      const random=((Math.imul(Math.floor(mid*circuit.length)+side*113,2654435761)>>>0)%1000)/1000;
      if(random>options.advertisingDensity||used.some(u=>Math.abs(u-mid)*circuit.length<18)||!valid(a,b,side,offset)||!advertisingAvoidsSigns(circuit,[a,b,side],recipe))continue;
      ads.push([a,b,side,offset]);used.push(mid);
    }
  }
  return ads;
}

import { compileLayout, samplePiece, MAX_TRACK_PIECES } from './track-pieces.js';

const tau=2*Math.PI,mod=a=>((a%tau)+tau)%tau;
const turn=(from,to,sign)=>mod(sign*(to-from));
const center=(p,sign,r)=>({x:p.z-sign*r*Math.sin(p.heading),y:p.x+sign*r*Math.cos(p.heading)});

// Forward-only, tangent circle/line routes between the end connector and the start.
function routes(end,r){
  const goal={x:0,z:0,heading:0},paths=[];
  if(Math.hypot(end.x,end.z)<1e-6&&Math.abs(Math.atan2(Math.sin(end.heading),Math.cos(end.heading)))<1e-6)for(const sign of [1,-1])paths.push([{turn:sign,angle:tau}]);
  for(const a of [1,-1])for(const b of [1,-1]){
    const c=center(end,a,r),d=center(goal,b,r),dx=d.x-c.x,dy=d.y-c.y,distance=Math.hypot(dx,dy),offset=(a-b)*r;
    if(distance<1e-8||distance<Math.abs(offset)-1e-8)continue;
    const heading=Math.atan2(dy,dx)+Math.asin(Math.max(-1,Math.min(1,offset/distance)));
    paths.push([{turn:a,angle:turn(end.heading,heading,a)},{length:Math.sqrt(Math.max(0,distance*distance-offset*offset))},{turn:b,angle:turn(heading,0,b)}]);
  }
  // Three-circle alternatives handle small gaps and opposite-facing connectors.
  for(const sign of [1,-1]){
    const a=center(end,sign,r),b=center(goal,sign,r),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d<1e-8||d>4*r)continue;
    const height=Math.sqrt(Math.max(0,4*r*r-d*d/4));
    for(const side of [1,-1]){
      const c={x:(a.x+b.x)/2-side*dy/d*height,y:(a.y+b.y)/2+side*dx/d*height};
      const h1=Math.atan2(sign*(c.x-a.x),-sign*(c.y-a.y));
      const h2=Math.atan2(-sign*(b.x-c.x),sign*(b.y-c.y));
      paths.push([{turn:sign,angle:turn(end.heading,h1,sign)},{turn:-sign,angle:turn(h1,h2,-sign)},{turn:sign,angle:turn(h2,0,sign)}]);
    }
  }
  return paths.map(segments=>({r,segments:segments.filter(s=>(s.length??s.angle*r)>1e-7)}));
}

function modules(route,rise){
  const length=route.segments.reduce((n,s)=>n+(s.length??s.angle*route.r),0),pieces=[];
  if(length<2||Math.abs(rise)*Math.PI/(2*length)>.34)return null;
  for(const segment of route.segments){
    const distance=segment.length??segment.angle*route.r;
    if(distance<2)return null;
    const totalRise=rise*distance/length,n=Math.max(1,Math.ceil(distance/(segment.turn?300:160)),Math.ceil(Math.abs(totalRise)/24));
    for(let i=0;i<n;i++){
      const dy=totalRise/n;
      pieces.push(segment.turn?{id:`curve-medium-${segment.turn>0?'left':'right'}`,radius:route.r,angle:segment.angle*180/Math.PI/n,rise:dy}:
        {id:Math.abs(dy)>1e-8?(dy>0?'ramp-up':'ramp-down'):'straight',length:distance/n,...(Math.abs(dy)>1e-8?{rise:dy}:{})});
    }
  }
  if(pieces.length)pieces.at(-1).widthFactorTo=1;
  return pieces;
}

/** Fit a final straight connector for small alignment errors; otherwise append a route. */
export function closeTrackLayout(pieces,startHeight=0){
  const compile=value=>compileLayout(value,10,startHeight),before=compile(pieces);
  if(!pieces.length)throw new Error('Añade al menos un tramo antes de cerrar el circuito.');
  if(before.closed){
    const value=structuredClone(pieces);
    if(Math.abs(before.endWidth-10)>=.01)value[value.length-1]={...(typeof value.at(-1)==='string'?{id:value.at(-1)}:value.at(-1)),widthFactorTo:1};
    return value;
  }
  const last=samplePiece(pieces.at(-1)).spec;
  if(pieces.length>1&&['straight','ramp','offset'].includes(last.kind)){
    const prefix=compile(pieces.slice(0,-1)),end=prefix.points.at(-1),c=Math.cos(end.heading),s=Math.sin(end.heading);
    const x=-end.x*c+end.z*s,z=-end.x*s-end.z*c;
    if(Math.abs(Math.atan2(Math.sin(end.heading),Math.cos(end.heading)))<1e-6&&z>=2&&z<=160&&Math.abs(x)<=12&&Math.abs(end.y-startHeight)<=24&&Math.abs(x)<=z*.25&&z*z>=6*Math.abs(x)*(Math.max(prefix.endWidth,10)/2+2)){
      const connector={id:x<0?'offset-right':'offset-left',length:z,amplitude:x,rise:startHeight-end.y,widthFactorTo:1,...(last.surface?{surface:last.surface}:{})};
      const fitted=[...structuredClone(pieces.slice(0,-1)),connector],data=compile(fitted);
      if(data.closed&&data.maxGrade<=Math.max(.36,before.maxGrade)+1e-6)return fitted;
    }
  }
  if(pieces.length>=MAX_TRACK_PIECES)throw new Error(`No queda espacio para el cierre: el límite es de ${MAX_TRACK_PIECES} tramos.`);
  const end=before.points.at(-1),candidates=[];
  for(const r of [12,16,24,32,48,64,96])for(const route of routes(end,r)){
    const added=modules(route,startHeight-end.y);
    if(added&&pieces.length+added.length<=MAX_TRACK_PIECES)candidates.push({added,length:route.segments.reduce((n,s)=>n+(s.length??s.angle*r),0)});
  }
  candidates.sort((a,b)=>a.length-b.length);
  let best,score=Infinity;
  for(const candidate of candidates.slice(0,24)){
    const value=[...structuredClone(pieces),...candidate.added],data=compile(value);
    if(!data.closed)continue;
    const extraErrors=data.errors.filter(e=>!before.errors.includes(e)).length;
    const extraCrossings=data.crossings.filter(p=>!before.crossings.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<2)).length;
    const cost=extraErrors*10000+extraCrossings*1000+candidate.length;
    if(cost<score){best=value;score=cost;}
    if(!extraErrors&&!extraCrossings)return value;
  }
  if(!best)throw new Error('No cabe un cierre con estos conectores. Libera tramos o acerca el extremo a la salida.');
  return best;
}

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Capsule footprint projected onto the road normal, shared with race contacts. */
export function edgeRadius(car,road=car.road){
 const v=car.vehicle||{},width=v.bodyWidth??(v.design?v.design.width*2:v.id==='coda'?1.6:1.9),length=v.bodyLength??(v.design?v.design.halfLength*2:v.id==='coda'?3:3.35);
 const radius=width/2,half=Math.max(.1,length/2-radius),alignment=Math.abs(Math.sin(car.heading)*road.nx+Math.cos(car.heading)*road.nz);
 return radius+half*alignment;
}

/** Resolve normal momentum once; grazing contacts retain their along-wall motion. */
export function resolveEdgeContact(car,dt){
 const road=car.road,wasTouching=car.edgeTouching===true;
 car.edgeTouching=false;car.edgeImpact=Math.max(0,(car.edgeImpact||0)-dt*5);car.edgeCooldown=Math.max(0,(car.edgeCooldown||0)-dt);
 const supported=road.supported!==false&&(!car.activeGap||car.y<road.y+1);
 const limit=Math.max(.15,car.circuit.widthAt(road.progress)/2-edgeRadius(car));
 const sign=Math.sign(road.offset)||1,nx=road.nx*sign,nz=road.nz*sign;
 const closing=Math.max(0,car.vx*nx+car.vz*nz),penetration=Math.abs(road.offset)-limit;
 let scrape=0;
 if(supported&&penetration>=-.008&&(penetration>0||closing>.02)){
  car.edgeTouching=true;
  if(penetration>0){car.x-=nx*penetration;car.z-=nz*penetration;road.offset=limit*sign;road.distance=Math.abs(road.offset);}
  const tangentX=car.vx-nx*closing,tangentZ=car.vz-nz*closing,tangentSpeed=Math.hypot(tangentX,tangentZ);
  car.edgeNormalX=nx;car.edgeNormalZ=nz;
  car.edgePan=clamp(nx*Math.cos(car.heading)-nz*Math.sin(car.heading),-1,1)*.65;
  if(closing>.02){
   const intensity=clamp((closing-.65)/9,0,1);
   const rebound=closing>2?Math.min(.09,(closing-2)*.008):0;
   const retain=Math.exp(-(.12+Math.min(1,closing/6)*.8)*dt);
   car.vx=tangentX*retain-nx*closing*rebound;car.vz=tangentZ*retain-nz*closing*rebound;
   if(closing>.9&&car.edgeCooldown===0&&(!wasTouching||closing>(car.edgeClosingSpeed||0)+2)){
    car.edgeHitId=(car.edgeHitId||0)+1;car.edgeImpact=Math.max(car.edgeImpact,intensity);car.impact=Math.max(car.impact||0,intensity);car.edgeCooldown=.18;
    const front=Math.sin(car.heading)*nx+Math.cos(car.heading)*nz,side=nx*Math.cos(car.heading)-nz*Math.sin(car.heading);
    car.angularSpeed=(car.angularSpeed||0)-clamp(front*side*closing*.025,-.28,.28);
    car.rollVelocity=(car.rollVelocity||0)+side*intensity*.16;
    car.pitchVelocity=(car.pitchVelocity||0)+front*intensity*.12;
    car.heaveVelocity=(car.heaveVelocity||0)-intensity*.08;
   }
  }
  car.edgeClosingSpeed=closing;
  scrape=clamp(tangentSpeed/25,0,1)*clamp(closing/3+.12,0,1);
 }else car.edgeClosingSpeed=0;
 car.edgeScrape=scrape+((car.edgeScrape||0)-scrape)*Math.exp(-(scrape>(car.edgeScrape||0)?14:20)*dt);
 return car.edgeTouching;
}

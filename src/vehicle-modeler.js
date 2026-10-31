import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TIRE_STYLES = ['road', 'slick', 'all-terrain'];
export const RIM_STYLES = ['classic', 'sport', 'mesh', 'rally', 'offroad'];
export const WRAP_STYLES = ['none', 'stripes', 'checkers', 'diagonal'];
const TAU=Math.PI*2, UP=new THREE.Vector3(0,1,0);

const mat=(name,color,roughness=.5,metalness=0)=>{
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness});m.name=name;return m;
};

/** Six planar panels in a fixed 3×2 atlas: left/right, top/bottom, front/rear.
 * Projection is selected per triangle, so no face gets collapsed UVs at a seam.
 * All body parts use the same vehicle-space atlas; wrapping continues across parts.
 */
export function panelUV(geometry, width=1, halfLength=2, height=2) {
  const g=geometry.index?geometry.toNonIndexed():geometry;
  const p=g.attributes.position,uv=new Float32Array(p.count*2),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);
    const n=b.cross(c),nx=Math.abs(n.x),ny=Math.abs(n.y),nz=Math.abs(n.z);
    const axis=nx>=ny&&nx>=nz?'x':ny>=nz?'y':'z';
    const col=axis==='x'?0:axis==='y'?1:2,sign=n[axis]>=0?1:0;
    for(let j=0;j<3;j++){
      const k=i+j,x=p.getX(k),y=p.getY(k),z=p.getZ(k);
      let u,v;
      if(axis==='x'){u=(z/halfLength+1)/2;if(!sign)u=1-u;v=y/height;}
      else if(axis==='y'){u=(x/width+1)/2;v=(z/halfLength+1)/2;}
      else {u=(x/width+1)/2;if(!sign)u=1-u;v=y/height;}
      uv[k*2]=(col+.025+u*.95)/3;uv[k*2+1]=(sign+.025+v*.95)/2;
    }
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}

function loft(rings){
  const positions=rings.flat(2),n=rings[0].length,indices=[];
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
    const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+j,d=(i+1)*n+(j+1)%n;
    indices.push(a,b,c,b,d,c);
  }
  // Ring contours are convex; center caps avoid degenerate fan triangles on straight edges.
  for(const [ring,front] of [[0,false],[rings.length-1,true]]){
    const points=rings[ring],center=[0,0,0];points.forEach(p=>p.forEach((v,k)=>center[k]+=v/n));
    const ci=positions.length/3;positions.push(...center);
    for(let j=0;j<n;j++)front?indices.push(ci,ring*n+j,ring*n+(j+1)%n):indices.push(ci,ring*n+(j+1)%n,ring*n+j);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function interpolate(stations,z){
  const i=stations.findIndex(s=>s[0]>=z);
  if(i<=0)return stations[Math.max(0,i)];
  const a=stations[i-1],b=stations[i],t=(z-a[0])/(b[0]-a[0]);
  return [z,THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];
}

function bodyGeometry(d){
  const cuts=new Set(d.stations.map(s=>s[0]));
  // Analytic arch sampling preserves a real lower silhouette around each wheel.
  for(const axle of [-d.wheelbase,d.wheelbase])for(let i=0;i<=12;i++){
    const z=(axle+Math.cos(i/12*Math.PI)*d.radius*1.14)/d.halfLength;
    if(z>-.99&&z<.99)cuts.add(z);
  }
  const lift=d.clearance-.24,rings=[...cuts].sort((a,b)=>a-b).map(z=>{
    const [,wf,deck]=interpolate(d.stations,z),w=wf*d.width,top=deck+lift;
    const worldZ=z*d.halfLength;
    let arch=.18+lift;
    for(const axle of [-d.wheelbase,d.wheelbase]){
      const delta=Math.abs(worldZ-axle),r=d.radius*1.14;
      if(delta<r)arch=Math.max(arch,d.radius+Math.sqrt(r*r-delta*delta));
    }
    const shoulder=Math.max(top-.1,arch+.025),edge=Math.max(top-.025,shoulder+.02);
    return [[w*.72,.16+lift,worldZ],[w,arch,worldZ],[w,shoulder,worldZ],[w*.91,edge,worldZ],[w*.64,Math.max(top,edge),worldZ],[-w*.64,Math.max(top,edge),worldZ],[-w*.91,edge,worldZ],[-w,shoulder,worldZ],[-w,arch,worldZ],[-w*.72,.16+lift,worldZ]];
  });
  return loft(rings);
}

// A single wheel has two replaceable mesh slots and no per-spoke draw calls.
export function wheelGeometry(radius,style='sport',tire='road',side=1,width=radius*.78){
  const rubber=[],metal=[],add=(list,g,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
    const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1));
    const raw=g.index?g.toNonIndexed():g;raw.applyMatrix4(m);list.push(raw);if(raw!==g)g.dispose();
  };
  add(rubber,new THREE.CylinderGeometry(radius,radius,width,20,1),0,0,0,0,0,Math.PI/2);
  if(tire!=='slick')for(const x of [-1,1])add(rubber,new THREE.TorusGeometry(radius*.9,radius*.045,4,20),x*width*.46,0,0,0,Math.PI/2);
  if(tire==='all-terrain')for(let i=0;i<18;i++){
    const a=i/18*TAU;add(rubber,new THREE.BoxGeometry(width*1.04,radius*.1,radius*.21),0,Math.cos(a)*radius*.99,Math.sin(a)*radius*.99,a,0,0);
  }
  const face=side*width*.53,r=radius*.65;
  if(style==='classic'||style==='rally'){
    add(metal,new THREE.CylinderGeometry(r,r,radius*.07,20),face,0,0,0,0,Math.PI/2);
    if(style==='classic')add(metal,new THREE.SphereGeometry(r*.58,12,6).scale(.28,1,1),face+side*.018,0,0);
    else for(let i=0;i<6;i++){const a=i/6*TAU;add(metal,new THREE.BoxGeometry(.025,r*.22,r*.22),face+side*.022,Math.cos(a)*r*.7,Math.sin(a)*r*.7,a);}
  }else{
    add(metal,new THREE.TorusGeometry(r,radius*.055,4,20),face,0,0,0,Math.PI/2);
    const spokes=style==='mesh'?12:style==='offroad'?6:5;
    for(let i=0;i<spokes;i++){
      const a=i/spokes*TAU;add(metal,new THREE.BoxGeometry(radius*.075,r*.83,radius*(style==='offroad'?.13:.075)),face,Math.cos(a)*r*.46,Math.sin(a)*r*.46,a);
      if(style==='mesh')add(metal,new THREE.BoxGeometry(radius*.055,r*.8,radius*.045),face,Math.cos(a+.15)*r*.48,Math.sin(a+.15)*r*.48,a+.46);
    }
  }
  add(metal,new THREE.CylinderGeometry(radius*.12,radius*.12,radius*.13,10),face,0,0,0,0,Math.PI/2);
  const merge=list=>{const g=mergeGeometries(list,false);list.forEach(p=>p.dispose());return g;};
  const tireMesh=merge(rubber);if(tire==='all-terrain')tireMesh.scale(1,1/1.04,1/1.04);
  return {tire:tireMesh,rim:merge(metal)};
}

export function defaultCustomization(vehicle){
  const f=vehicle.design.features;
  const offroad=vehicle.batch==='adventure'&&vehicle.design.clearance>.33;
  return {color:vehicle.color,secondary:f.includes('white-roof')||f.includes('two-tone')?'#e8e3cf':'#222b32',wrap:'none',rim:f.includes('wire-wheels')?'mesh':f.includes('gold-wheels')?'sport':vehicle.batch==='heritage'?'classic':offroad?'offroad':vehicle.batch==='drivers'?'rally':'sport',rimColor:f.includes('gold-wheels')?'#bc9a54':'#b8c1c6',tire:offroad?'all-terrain':'road',glass:'#567681',glassOpacity:.85,trail:'none'};
}

export function buildCollectionVehicle(vehicle,custom={}){
  const d=vehicle.design, f=new Set(d.features),cfg={...defaultCustomization(vehicle),...custom};
  const group=new THREE.Group();group.name=vehicle.id;
  const wheels=[],frontWheels=[],wheelSlots=[],parts=[];
  const materials={
    paint:mat('exterior-paint',cfg.color,.29,.28),secondary:mat('secondary-paint',cfg.secondary,.36,.16),
    glass:mat('windows',cfg.glass,.16,.24),rubber:mat('rubber','#20262a',.92),rims:mat('rims',cfg.rimColor,.25,.75),
    trim:mat('black-trim','#253039',.64),chrome:mat('chrome','#c6cdd0',.24,.8),
    interior:mat('interior','#3e4442',.95),headlights:mat('headlights','#f8edca',.23,.15),brakes:mat('taillights','#a82c23',.29,.12),
  };
  materials.glass.transparent=true;materials.glass.opacity=cfg.glassOpacity;materials.glass.depthWrite=false;materials.glass.forceSinglePass=true;
  materials.brakes.emissive.set('#ff0802');materials.brakes.emissiveIntensity=0;
  materials.headlights.emissive.set('#e4d9b9');materials.headlights.emissiveIntensity=.18;
  const add=(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
    const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);parts.push(o);return o;
  };
  const box=(x,y,z,w,h,l,m=materials.paint)=>add(new THREE.BoxGeometry(w,h,l),m,x,y,z);
  const beam=(a,b,r,m=materials.chrome)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
    const o=add(new THREE.CylinderGeometry(r,r,dir.length(),8),m);o.position.copy(start.add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(UP,dir.normalize());return o;
  };
  const sphere=(x,y,z,rx,ry,rz,m)=>{const o=add(new THREE.SphereGeometry(1,16,8),m,x,y,z);o.scale.set(rx,ry,rz);return o;};
  // Thin closed quads, offset from the panel behind them, for glass and vent insets.
  const panel=(points,m,depth=.012)=>{
    const a=new THREE.Vector3(...points[0]),n=new THREE.Vector3(...points[1]).sub(a).cross(new THREE.Vector3(...points[2]).sub(a)).normalize().multiplyScalar(depth);
    const g=loft([points.map(p=>[...p]),points.map(p=>[p[0]+n.x,p[1]+n.y,p[2]+n.z])]);
    return add(g,m);
  };
  const L=d.halfLength,W=d.width, lift=d.clearance-.24;
  const deckAt=z=>interpolate(d.stations,Math.max(-1,Math.min(1,z/L)))[2]+lift;
  add(bodyGeometry(d),materials.paint);
  box(0,.19+lift,0,W*1.36,.14,L*1.7,materials.trim);
  // Individually named steering/rolling pivots. All wheels rotate around local X.
  for(const side of [-1,1])for(const front of [false,true]){
    const label=`${front?'front':'rear'}-${side<0?'left':'right'}`,steer=new THREE.Group(),roll=new THREE.Group();
    steer.name=`steer-${label}`;roll.name=`wheel-${label}`;
    steer.position.set(side*W*.97,d.radius,front?d.wheelbase:-d.wheelbase);steer.add(roll);group.add(steer);
    const geometry=wheelGeometry(d.radius,cfg.rim,cfg.tire,side,d.tireWidth),tire=new THREE.Mesh(geometry.tire,materials.rubber),rim=new THREE.Mesh(geometry.rim,materials.rims);
    tire.name=`tire-${label}`;rim.name=`rim-${label}`;roll.add(tire,rim);wheelSlots.push({roll,tire,rim,side,radius:d.radius,width:d.tireWidth});
    wheels.push(roll);if(front)frontWheels.push(steer);
  }

  const [rb,rt,ft,fb,H,rwf]=d.cabin,zrb=rb*L,zrt=rt*L,zft=ft*L,zfb=fb*L;
  const sill=Math.max(deckAt(zrb),deckAt(zfb))+.018,rw=W*rwf,sw=W*.92;
  const roofMat=f.has('white-roof')||f.has('black-roof')||f.has('fabric-roof')?materials.secondary:materials.paint;
  if(!f.has('open')){
    // Rounded classics and GTs have a compound crown; wedges/utilities retain a flat roof.
    const roundRoof=['micro','round','pontoon','long','exotic'].includes(d.shape);
    const roofRings=Array.from({length:roundRoof?7:2},(_,i)=>{
      const t=i/(roundRoof?6:1),z=THREE.MathUtils.lerp(zrt,zft,t),crown=roundRoof?Math.sin(t*Math.PI)*.045:0;
      return [[rw*.95,H-.075,z],[rw,H-.045+crown,z],[rw*.87,H+.005+crown,z],[rw*.42,H+.018+crown,z],[-rw*.42,H+.018+crown,z],[-rw*.87,H+.005+crown,z],[-rw,H-.045+crown,z],[-rw*.95,H-.075,z]];
    });
    add(loft(roofRings),roofMat);
    panel([[-sw,sill,zfb],[sw,sill,zfb],[rw*.95,H-.065,zft],[-rw*.95,H-.065,zft]],materials.glass);
    if(!f.has('van-windows'))panel([[sw,sill,zrb],[-sw,sill,zrb],[-rw*.95,H-.065,zrt],[rw*.95,H-.065,zrt]],materials.glass);
    else {
      box(0,(sill+H)*.5,zrb,sw*2,H-sill,.035,materials.secondary);
      box(0,H-.28,zrb-.025,sw*1.45,.34,.02,materials.glass);
    }
    for(const side of [-1,1]){
      if(!f.has('van-windows'))panel([[side*sw,sill,zrb],[side*sw,sill,zfb],[side*rw,H-.065,zft],[side*rw,H-.065,zrt]],materials.glass);
      else box(side*W*.935,(sill+H)*.5,(zrb+zfb)*.5,.045,H-sill-.04,zfb-zrb,materials.secondary);
      for(const [bz,tz] of [[zrb,zrt],[zfb,zft]])beam([side*sw,sill-.01,bz],[side*rw,H-.02,tz],.025,materials.paint);
      const bz=THREE.MathUtils.lerp(zrb,zfb,.56),tz=THREE.MathUtils.lerp(zrt,zft,.56);
      if(zft-zrt>.5&&!f.has('center-seat'))beam([side*sw,sill,bz],[side*rw,H-.05,tz],.021,materials.trim);
      beam([side*sw,sill-.02,zrb],[side*sw,sill-.02,zfb],.022,materials.paint);
    }
    if(f.has('fabric-roof'))box(0,H+.026,(zrt+zft)*.5,rw*1.65,.018,(zft-zrt)*.85,materials.trim);
    if(f.has('split-rear'))beam([0,sill+.01,zrb-.01],[0,H-.03,zrt-.01],.023,materials.paint);
    if(f.has('split-screen'))beam([0,sill+.01,zfb+.02],[0,H-.04,zft+.02],.025,materials.paint);
  }else{
    // A real inset cockpit: a dark well covers the structural deck, then seats and screen.
    const seatZ=(zrb+zfb)*.5;
    box(0,deckAt(seatZ)+.032,seatZ,W*1.43,.06,(zfb-zrb)*.83,materials.interior);
    for(const side of [-1,1]){
      box(side*W*.35,deckAt(seatZ)+.12,seatZ-.06,W*.48,.12,.41,materials.interior);
      const seat=box(side*W*.35,deckAt(seatZ)+.18,zrb+.16,W*.48,.28,.13,materials.interior);seat.rotation.x=-.12;
    }
    const windH=f.has('flat-screen')?H:H-.05;
    panel([[-sw*.91,sill+.02,zfb],[sw*.91,sill+.02,zfb],[rw,windH,zft],[-rw,windH,zft]],materials.glass);
    for(const side of [-1,1])beam([side*sw*.91,sill,zfb],[side*rw,windH,zft],.021);
    beam([-rw,windH,zft],[rw,windH,zft],.022);
    add(new THREE.TorusGeometry(.11,.014,6,16),materials.trim,-W*.35,sill+.22,zfb-.15,.4);
  }
  // Functional secondaries: lamps, bumpers, door lines, mirrors and rear lenses.
  const frontY=deckAt(L*.85)-.08,rearY=deckAt(-L)-.1,rearWidth=d.stations[0][1]*W,rearZ=-L-.012;
  const lamp=(x,y,z,r=.105)=>sphere(x,y,z,r,r,.035,materials.headlights);
  for(const side of [-1,1]){
    if(['round','standalone','quad-round','stacked'].includes(d.lights)){
      const x=side*W*(d.lights==='standalone'?.7:.7);
      lamp(x,frontY,L*.96,d.lights==='standalone'?.12:.106);
      if(d.lights==='quad-round')lamp(x-side*.22,frontY,L*.98,.09);
      if(d.lights==='stacked')lamp(x,frontY-.19,L*.96,.085);
    }else if(d.lights==='hidden'){
      box(side*W*.68,deckAt(L*.72)+.019,L*.73,W*.36,.018,.22,materials.trim);
      box(side*W*.66,frontY-.1,L*.989,W*.39,.055,.025,materials.headlights);
    }else if(d.lights==='covered'){
      const o=sphere(side*W*.69,frontY+.03,L*.88,W*.2,.08,.17,materials.headlights);o.rotation.y=side*-.18;
    }else if(d.lights==='triple'){
      for(let i=0;i<3;i++)lamp(side*W*.72,frontY+.03-i*.1,L*(.87+i*.04),.05);
    }else{
      const blade=d.lights==='blade';box(side*W*.67,frontY,L*.97,W*.44,blade?.035:.12,.035,materials.headlights);
      if(d.lights==='quad-square')box(side*W*.4,frontY,L*.98,W*.2,.105,.035,materials.headlights);
    }
    if(f.has('round-tails'))for(let i=0;i<2;i++)sphere(side*rearWidth*(.36+i*.31),rearY,rearZ,.065,.065,.028,materials.brakes);
    else box(side*rearWidth*.62,rearY,rearZ,rearWidth*.45,.11,.04,materials.brakes);
    if(!f.has('hotrod')){
      box(side*W*1.03,sill+.1,zfb-.14,.17,.075,.16,materials.paint);
      beam([side*W*.9,sill+.02,zfb-.14],[side*W*1.02,sill+.09,zfb-.14],.022,materials.trim);
      const doorZ=(zrb+zfb)*.5;
      box(side*W*.999,deckAt(doorZ)-.035,doorZ,.013,.025,.16,materials.chrome);
    }
    if(f.has('side-skirts')||f.has('panda'))box(side*W,.24+lift,0,.09,.12,d.wheelbase*1.4,materials.trim);
    if(f.has('side-pipes'))beam([side*W*1.09,.27+lift,-d.wheelbase*.65],[side*W*1.09,.27+lift,d.wheelbase*.53],.065);
    if(f.has('side-gills')||f.has('side-strakes')){
      const count=f.has('side-strakes')?6:3;
      for(let i=0;i<count;i++){
        const z=f.has('side-strakes')?-.12*L:.4*L+i*.08;
        box(side*W*.99,.48+lift+i*(f.has('side-strakes')?.045:0),z,.02,.018,f.has('side-strakes')?.77:.045,materials.trim);
      }
    }
    if(f.has('side-intakes')){
      panel([[side*W*1.006,.36+lift,-L*.12],[side*W*1.006,.67+lift,-L*.23],[side*W*.94,.71+lift,-L*.57],[side*W*1.006,.4+lift,-L*.51]],materials.trim);
    }
    if(f.has('widebody')||f.has('beetle-fenders')||f.has('cycle-fenders'))for(const axle of [-d.wheelbase,d.wheelbase]){
      const o=add(new THREE.TorusGeometry(d.radius*1.13,.045,5,16,Math.PI),f.has('cycle-fenders')?materials.secondary:materials.paint,side*W*.995,d.radius,axle,0,Math.PI/2);
      // Torus starts in local XY: rotated arc stays above its own wheel.
      o.scale.z=f.has('beetle-fenders')?2.5:1.3;
    }
  }
  const chromeBumper=f.has('chrome-bumpers')||f.has('slim-chrome');
  for(const sign of [-1,1])box(0,.34+lift,sign*L*.987,W*1.7,chromeBumper?.065:.09,.065,chromeBumper?materials.chrome:materials.trim);
  if(f.has('tail-bar'))box(0,rearY,rearZ-.005,rearWidth*1.7,.045,.03,materials.brakes);
  const grilleY=frontY-.13;
  if(f.has('vertical-grille')||f.has('horseshoe')){
    const width=f.has('horseshoe')?W*.49:W*.7;box(0,grilleY,L*.996,width,.3,.035,materials.trim);
    for(let i=-3;i<=3;i++)box(i*width/8,grilleY,L*1.009,.018,.26,.014,materials.chrome);
  }else{
    box(0,grilleY,L*.996,W*(f.has('full-grille')?1.6:.85),.16,.027,materials.trim);
    if(f.has('split-grille'))box(0,grilleY,L*1.012,.035,.16,.015,materials.paint);
    if(f.has('oval-grille')){const o=add(new THREE.TorusGeometry(1,.04,4,24),materials.chrome,0,grilleY,L*1.015);o.scale.set(W*.46,.12,.4);}
  }
  if(f.has('hood-scoop')||f.has('shaker')||f.has('bonnet-bulge')){
    const z=L*.55,y=deckAt(z);
    const o=sphere(0,y+.035,z,W*.25,.095,.35,materials.paint);
    if(!f.has('bonnet-bulge'))box(0,y+.09,z+.25,W*.35,.055,.025,materials.trim);
  }
  if(f.has('slats')||f.has('louvers')||f.has('rear-engine')||f.has('bonnet-vents')){
    const rear=!f.has('bonnet-vents');
    for(let i=0;i<6;i++){
      const z=(rear?-1:1)*L*(.69+i*.04);box(0,deckAt(z)+.025,z,W*.96,.016,.024,materials.trim);
    }
  }
  if(f.has('fog-lamps')||f.has('rally-pod')){
    const count=f.has('rally-pod')?4:2;
    for(let i=0;i<count;i++){
      const x=(i-(count-1)/2)*.22;box(x,frontY-.03,L*.986,.2,.2,.09,materials.trim);lamp(x,frontY-.03,L*1.025,.085);
    }
  }
  if(f.has('roof-scoop')){
    box(0,H+.065,(zft+zrt)*.4,.26,.12,.38,materials.paint);box(0,H+.067,(zft+zrt)*.4+.195,.19,.065,.015,materials.trim);
  }
  // Distinct aero families: low ducktail, whale tail, hoop or elevated wing.
  const wingTypes=['wing','box-wing','delta-wing','tall-wing','hoop-wing','bridge-wing','active-wing','whale-tail','ducktail'];
  const wingType=wingTypes.find(t=>f.has(t));
  if(wingType){
    const z=-L*.83,base=deckAt(z),tall=wingType==='tall-wing',low=['ducktail','whale-tail','active-wing'].includes(wingType);
    const h=tall?.75:low?.09:.32,y=base+h;
    for(const side of [-1,1])box(side*W*(wingType==='hoop-wing'?.8:.64),base+h*.5,z,.055,h,.14,materials.paint);
    box(0,y,z,W*(wingType==='delta-wing'?2.05:1.86),.065,wingType==='whale-tail'?.46:.26,wingType==='whale-tail'?materials.trim:materials.paint);
    if(['box-wing','wing','delta-wing'].includes(wingType))for(const side of [-1,1])box(side*W*.94,y+.07,z,.025,.2,.3,materials.paint);
  }
  if(f.has('fins'))for(const side of [-1,1]){
    const o=box(side*W*.87,rearY+.22,-L*.77,.075,.36,.7,materials.paint);o.rotation.x=-.2;
    beam([side*W*.87,rearY+.42,-L*.92],[side*W*.87,rearY+.36,-L*.57],.017);
  }
  if(f.has('two-tone')||f.has('panda')){
    for(const side of [-1,1])box(side*W*1.005,.39+lift,0,.018,.13,L*1.6,materials.secondary);
  }
  if(f.has('buttress'))for(const side of [-1,1])beam([side*rw,H-.02,zrt],[side*W*.85,deckAt(-L*.79),-L*.79],.065,materials.paint);
  if(f.has('t-top'))box(0,H+.031,(zrt+zft)*.5,W*1.05,.016,(zft-zrt)*.7,materials.glass);
  if(f.has('bubble-door')){
    beam([0,.42,L*.99],[0,sill,L*.94],.016,materials.chrome);
    box(-W*.2,.63,L*1.008,.18,.025,.02,materials.chrome);
  }
  if(f.has('covered-rear'))for(const side of [-1,1])box(side*W*1.035,d.radius*1.5,-d.wheelbase,.03,d.radius*.7,d.radius*1.65,materials.paint);
  if(f.has('beetle-fenders'))for(const side of [-1,1])for(const axle of [-d.wheelbase,d.wheelbase]){
    sphere(side*W*.82,d.radius*1.88,axle,W*.29,.095,d.radius*1.48,materials.paint);
  }
  if(f.has('standalone-lamps')||d.lights==='standalone')for(const side of [-1,1]){
    const x=side*W*.7,z=L*.91;
    beam([x,.4+lift,z],[x,frontY,z],.025,materials.chrome);
    add(new THREE.CylinderGeometry(.125,.125,.16,12),materials.chrome,x,frontY,z,Math.PI/2);
    sphere(x,frontY,z+.09,.11,.11,.025,materials.headlights);
  }
  if(f.has('eyelashes'))for(const side of [-1,1])for(let i=0;i<6;i++){
    const x=side*W*.69+(i-2.5)*.045,z=L*.88;
    beam([x,frontY+.1,z],[x,frontY+.13,z-.07],.009,materials.trim);
  }
  if(f.has('naca'))for(const side of [-1,1]){
    const y=deckAt(L*.54)+.032;
    panel([[side*W*.48,y,L*.69],[side*W*.37,y,L*.42],[side*W*.58,y,L*.42]],materials.trim);
  }
  if(f.has('roof-doors'))for(const side of [-1,1])beam([side*rw*.66,H+.045,zrt+.05],[side*rw*.66,H+.045,zft-.03],.009,materials.trim);
  if(f.has('center-seat')){
    box(0,sill+.15,(zrt+zft)*.5,.33,.31,.2,materials.interior);
    for(const side of [-1,1])box(side*.37,sill+.08,zrt+.2,.29,.25,.18,materials.interior);
  }
  if(f.has('hotrod')||f.has('rollbar')){
    const y=f.has('hotrod')?.93:H+.16,z=zrb+.08;
    for(const side of [-1,1])beam([side*W*.57,sill,z],[side*W*.57,y,z],.03);
    beam([-W*.57,y,z],[W*.57,y,z],.03);
  }
  if(f.has('open-engine')){
    box(0,.67,L*.4,.47,.34,.68,materials.chrome);
    for(const side of [-1,1])for(let i=0;i<4;i++)beam([side*.18,.75,L*.2+i*.13],[side*.42,.43,L*.2+i*.13],.025,materials.chrome);
  }
  if(f.has('pickup')){
    // Open cargo bed, with a lowered dark floor and three structural rails.
    box(0,.91,-L*.54,W*1.68,.04,L*.7,materials.trim);
    for(const side of [-1,1])box(side*W*.91,1.03,-L*.56,.1,.27,L*.77,materials.paint);
    box(0,1.02,-L*.94,W*1.82,.25,.08,materials.paint);
    for(let i=-3;i<=3;i++)box(i*.18,.944,-L*.55,.025,.015,L*.65,materials.chrome);
  }
  if(f.has('van-windows'))for(const side of [-1,1])for(let i=0;i<4;i++)box(side*W*.985,1.39,-L*.72+i*L*.32,.018,.36,.39,materials.glass);
  if(f.has('roof-rack')){
    for(const side of [-1,1])beam([side*W*.72,H+.12,zrt],[side*W*.72,H+.12,zft],.022,materials.trim);
    for(let i=0;i<4;i++){const z=THREE.MathUtils.lerp(zrt,zft,i/3);beam([-W*.72,H+.12,z],[W*.72,H+.12,z],.022,materials.trim);}
    for(const side of [-1,1])for(const z of [zrt,zft])beam([side*W*.72,H,z],[side*W*.72,H+.12,z],.02,materials.trim);
  }
  if(f.has('spare')){
    add(new THREE.CylinderGeometry(d.radius,d.radius,.2,20),materials.rubber,W*.25,.86,-L*1.04,Math.PI/2);
    add(new THREE.CylinderGeometry(d.radius*.58,d.radius*.58,.22,16),materials.rims,W*.25,.86,-L*1.04,Math.PI/2);
    box(W*.25,.8,-L,.16,.25,.2,materials.trim);
  }
  if(f.has('jerrycan'))box(-W*.6,.88,-L*1.03,.22,.38,.14,materials.secondary);
  if(f.has('nose-cone')){
    add(loft([[[W*.8,.38,L*.89],[W*.85,.67,L*.89],[-W*.85,.67,L*.89],[-W*.8,.38,L*.89]],[[W*.65,.4,L*1.08],[W*.65,.46,L*1.08],[-W*.65,.46,L*1.08],[-W*.65,.4,L*1.08]]]),materials.paint);
  }
  // Exhaust tips are present even when future trail effects are disabled.
  if(!f.has('electric'))for(const side of [-1,1]){
    const count=f.has('quad-exhaust')?2:1;
    for(let i=0;i<count;i++)add(new THREE.CylinderGeometry(.038,.038,.11,8),materials.chrome,side*(W*.48+i*.09),.25+lift,-L*.98,Math.PI/2);
  }
  // Merge stationary parts by material; independent customization materials stay independent.
  const buckets=new Map();
  for(const o of parts){
    o.updateMatrix();let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
    if(o.material===materials.paint)g=panelUV(g,W*1.2,L*1.15,Math.max(2,H+.3));
    if(!g.attributes.uv)g=panelUV(g,W*1.2,L*1.15,Math.max(2,H+.3));
    const list=buckets.get(o.material)||[];list.push(g);buckets.set(o.material,list);o.geometry.dispose();
  }
  for(const [m,list]of buckets){const g=mergeGeometries(list,false);list.forEach(p=>p.dispose());if(!g)throw new Error(`No se pudo montar ${vehicle.id}`);const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.receiveShadow=true;group.add(mesh);}
  const sockets={};
  for(const side of [-1,1])for(const kind of ['trail-rear','exhaust']){
    const name=`${kind}-${side<0?'left':'right'}`,node=new THREE.Object3D();node.name=name;
    node.position.set(side*W*(kind==='trail-rear'?.97:.48),kind==='trail-rear'?.035:.25+lift,kind==='trail-rear'?-d.wheelbase:-L);
    node.userData.socket=kind;group.add(node);sockets[name]=node;
  }
  group.userData={vehicleId:vehicle.id,batch:vehicle.batch,axes:'+Y up, +Z forward',customization:{version:1,slots:['exterior-paint','secondary-paint','windows','rubber','rims'],uvLayout:'panel-atlas-3x2',...cfg}};
  const model={group,wheels,frontWheels,wheelSlots,materials,sockets,vehicle,customization:cfg,brakeMaterials:[materials.brakes],brakeRearZ:-L*1.025};
  return model;
}

/** Applies an artist-supplied UV texture without rebuilding any mesh. */
export function applyWrapTexture(model,texture){
  if(texture){texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.needsUpdate=true;}
  model.materials.paint.map=texture;model.materials.paint.needsUpdate=true;
}

export function customizeVehicle(model,patch){
  const cfg=model.customization,m=model.materials;
  if(!m)return;
  Object.assign(cfg,patch);
  if(patch.color)m.paint.color.set(patch.color);
  if(patch.secondary)m.secondary.color.set(patch.secondary);
  if(patch.rimColor)m.rims.color.set(patch.rimColor);
  if(patch.glass)m.glass.color.set(patch.glass);
  if(patch.glassOpacity!==undefined){m.glass.opacity=THREE.MathUtils.clamp(patch.glassOpacity,.2,1);}
  if(patch.rim||patch.tire)for(const slot of model.wheelSlots){
    const g=wheelGeometry(slot.radius,cfg.rim,cfg.tire,slot.side,slot.width);
    slot.tire.geometry.dispose();slot.rim.geometry.dispose();slot.tire.geometry=g.tire;slot.rim.geometry=g.rim;
  }
  Object.assign(model.group.userData.customization,cfg);
}

export function disposeVehicle(model){
  const gs=new Set(),ms=new Set(),ts=new Set();
  model.group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});
  ms.forEach(m=>{if(m.map)ts.add(m.map);m.dispose();});gs.forEach(g=>g.dispose());ts.forEach(t=>t.dispose());model.group.removeFromParent();
}

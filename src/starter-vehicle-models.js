import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Editable coachwork in metres, +Y up / +Z nose. Original designs, no badges.
 * Separate sprung body and four unsprung wheels; shared by showroom and race.
 * The silhouettes draw on a 1970s short-bed pickup, Evolution VI and Cobra 427.
 */
export const STARTER_DESIGNS = {
  coda: { length: 3.32, width: 1.52, radius: .285, tireWidth: .205, wheelbase: 2.05, track: 1.33, sill: .245,
    stations: [[-1.66,.66,.76],[-1.55,.73,.80],[-1.08,.76,.81],[-.47,.74,.81],[.15,.72,.83],[.76,.75,.84],[1.25,.73,.81],[1.58,.66,.74],[1.66,.61,.69]],
    roof: 1.365, inspiration: 'Pick-up americana de los años 70 · cabina sencilla y caja corta' },
  apex: { length: 3.78, width: 1.58, radius: .267, tireWidth: .218, wheelbase: 2.22, track: 1.36, sill: .195,
    stations: [[-1.89,.65,.64],[-1.72,.75,.70],[-1.12,.79,.73],[-.60,.76,.72],[.20,.76,.73],[1.11,.79,.72],[1.60,.73,.65],[1.83,.66,.58],[1.89,.61,.53]],
    roof: 1.20, inspiration: 'Sedán de homologación de finales de los 90 · Evolution VI' },
  velo: { length: 3.52, width: 1.58, radius: .279, tireWidth: .245, wheelbase: 2.02, track: 1.34, sill: .195,
    stations: [[-1.76,.46,.46],[-1.61,.63,.60],[-1.29,.75,.66],[-1.01,.79,.67],[-.68,.72,.60],[-.25,.67,.57],[.20,.69,.60],[.65,.75,.67],[1.01,.79,.69],[1.33,.71,.62],[1.60,.56,.49],[1.76,.43,.41]],
    roof: .99, inspiration: 'Roadster británico con V8 de los años 60 · Cobra 427' },
};
const UP=new THREE.Vector3(0,1,0);
const lerp=THREE.MathUtils.lerp;

// Regular patches preserve smooth highlights. Panel UVs are planar in car space;
// a later skin pass can replace the atlas without altering the moving parts.
function patch(fn,nu=12,nv=24){
  const positions=[],uvs=[],indices=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
    const u=i/nu,v=j/nv;positions.push(...fn(u,v));uvs.push(u,v);
  }
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function station(d,z){
  const s=d.stations;let i=1;while(i<s.length-1&&s[i][0]<z)i++;
  const a=s[i-1],b=s[i],t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
  // Smoothstep prevents ridges between body stations while keeping axle bulges.
  const f=t*t*(3-2*t);return [lerp(a[1],b[1],f),lerp(a[2],b[2],f)];
}
function paintMaterial(color){
  return new THREE.MeshPhysicalMaterial({name:'exterior-paint',color,metalness:.48,roughness:.28,clearcoat:1,clearcoatRoughness:.17});
}
function mat(name,color,roughness=.5,metalness=0){return new THREE.MeshStandardMaterial({name,color,roughness,metalness});}

export function buildStarterVehicle(vehicle){
  const d=STARTER_DESIGNS[vehicle.id];if(!d)throw new Error(`Unknown starter vehicle: ${vehicle.id}`);
  const pickup=vehicle.id==='coda',rally=vehicle.id==='apex',cobra=vehicle.id==='velo';
  const group=new THREE.Group();group.name=vehicle.id;
  const bodyRig=new THREE.Group();bodyRig.name='sprung-body';group.add(bodyRig);
  group.userData={vehicleId:vehicle.id,modelVersion:2,axes:'+Y up, +Z forward',inspiration:d.inspiration,wheelRadius:d.radius,wheelbase:d.wheelbase,track:d.track};
  const materials={paint:paintMaterial(vehicle.color),secondary:mat('secondary-paint','#d8d1b8',.34,.35),
    glass:new THREE.MeshPhysicalMaterial({name:'windows',color:'#758c98',metalness:.1,roughness:.12,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide,clearcoat:1}),
    rubber:mat('rubber','#151719',.88),rims:mat('rims',cobra?'#c5c9cd':pickup?'#bec2bf':'#c4c9ce',.23,.85),
    trim:mat('black-trim','#161c21',.52),chrome:mat('chrome','#d5d9da',.18,.94),
    interior:mat('interior','#24282b',.88),headlights:mat('headlights','#d7e4e7',.16,.25),
    brakes:mat('taillights','#8e0910',.22,.15),amber:mat('indicators','#d97c1b',.25,.1),discs:mat('brake-discs','#62696d',.4,.78),calipers:mat('brake-calipers','#96302c',.5,.15)};
  materials.glass.forceSinglePass=true;
  materials.brakes.emissive.set('#ff0903');materials.brakes.emissiveIntensity=0;
  materials.headlights.side=THREE.DoubleSide;
  materials.headlights.emissive.set('#edf5ff');materials.headlights.emissiveIntensity=.08;
  const parts=[],wheels=[],frontWheels=[],wheelSlots=[],sockets={};
  const add=(geometry,material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parts.push(m);return m;
  };
  const box=(x,y,z,w,h,l,m=materials.paint,r=.015)=>add(new RoundedBoxGeometry(w,h,l,1,Math.max(.001,Math.min(r,w*.35,h*.35,l*.35))),m,x,y,z);
  const tube=(points,r=.007,m=materials.trim)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve,Math.max(3,points.length*3),r,5,false),m);
  };
  const frame=(points,r=.007,m=materials.trim)=>{
    for(let i=1;i<points.length;i++)beam(points[i-1],points[i],r,m);
  };
  const beam=(a,b,r=.012,m=materials.chrome)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const mesh=add(new THREE.CylinderGeometry(r,r,delta.length(),8),m);mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(UP,delta.normalize());return mesh;
  };
  const ellipsoid=(x,y,z,rx,ry,rz,m)=>{const o=add(new THREE.SphereGeometry(1,20,12),m,x,y,z);o.scale.set(rx,ry,rz);return o;};
  const pane=(p,m=materials.glass)=>add(patch((u,v)=>p[0].map((x,i)=>lerp(lerp(x,p[1][i],u),lerp(p[3][i],p[2][i],u),v)),8,8),m);
  const top=(x,z)=>{
    const [w,y]=station(d,z),f=Math.abs(x)/w;
    return y-.075*f*f + (cobra?.15*Math.exp(-(((Math.abs(z)-1.28)/.43)**2))*f*f:0);
  };
  const archRadius=d.radius+.045;
  const lowerAt=z=>{
    let y=d.sill;for(const axle of [-d.wheelbase/2,d.wheelbase/2]){
      const dz=z-axle;if(Math.abs(dz)<archRadius)y=Math.max(y,d.radius+Math.sqrt(archRadius*archRadius-dz*dz));
    }return y;
  };
  // Upper skin is split around open cockpit / pickup bed. No solid block behind
  // the wheels: side panels terminate on the actual wheel-arch contour.
  const topRange=(z0,z1,x0=-1,x1=1)=>add(patch((u,v)=>{
    const z=lerp(z0,z1,v),w=station(d,z)[0],x=w*.90*lerp(x0,x1,u);return [x,top(x,z),z];
  },18,Math.max(8,Math.ceil((z1-z0)*28))),materials.paint);
  if(cobra){topRange(-d.length/2,-.99);topRange(.14,d.length/2);topRange(-.99,.14,-1,-.76);topRange(-.99,.14,.76,1);}
  else if(pickup){topRange(-.48,d.length/2);topRange(-d.length/2,-.48,-1,-.86);topRange(-d.length/2,-.48,.86,1);}
  else topRange(-d.length/2,d.length/2);
  for(const side of [-1,1]){
    add(patch((u,v)=>{
      const z=lerp(-d.length/2,d.length/2,side<0?1-v:v),[w]=station(d,z),upper=top(w*.90,z),lower=lowerAt(z);
      const shoulder=Math.max(lower+.010,upper-.070);
      if(u<=.375){const a=u/.375*Math.PI/2;return [side*w*(.90+.10*Math.sin(a)),upper-(upper-shoulder)*(1-Math.cos(a)),z];}
      const t=(u-.375)/.625;return [side*(w-.025*t*t),lerp(shoulder,lower,t),z];
    },8,112),materials.paint);
    // Rolled metal arch lips follow the cutout, with a dark inner return.
    for(const axle of [-d.wheelbase/2,d.wheelbase/2]){
      const edge=[];for(let i=0;i<=24;i++){
        const a=i/24*Math.PI,z=axle+Math.cos(a)*archRadius;edge.push([side*(station(d,z)[0]+.002),d.radius+Math.sin(a)*archRadius,z]);
      }
      tube(edge,pickup?.016:.010,materials.paint);
      tube(edge.map(([x,y,z])=>[x-side*.022,y-.012,z]),.017,materials.trim);
    }
    // Rocker panels occupy the real clear space between the tires.
    box(side*(d.width/2-.027),d.sill+.025,0,.055,.065,d.wheelbase-2*archRadius,materials.paint,.014);
  }
  // Underfloor stays inside the wheels and never plugs the arch openings.
  box(0,d.sill-.025,0,d.track-.28,.065,d.length*.79,materials.trim,.025);
  for(const rear of [-1,1]){
    const z=rear*(d.length/2-.008),[w,y]=station(d,z);
    add(patch((u,v)=>[lerp(-w,w,rear>0?1-u:u),lerp(d.sill,y-.04,v),z],18,8),materials.paint);
  }

  // Four complete tires, rim barrels, discs, hubs and recessed spokes. Roll and
  // steer pivots are independent, and tires turn about X at their true radius.
  for(const side of [-1,1])for(const front of [false,true]){
    const label=`${front?'front':'rear'}-${side<0?'left':'right'}`,steer=new THREE.Group(),roll=new THREE.Group();
    steer.name=`steer-${label}`;roll.name=`wheel-${label}`;steer.position.set(side*d.track/2,d.radius,(front?1:-1)*d.wheelbase/2);
    steer.userData={side,front,restY:d.radius};steer.add(roll);group.add(steer);
    const tireProfile=[[-.5,.72],[-.52,.85],[-.43,.96],[-.29,1],[.29,1],[.43,.96],[.52,.85],[.5,.72]];
    const tireGeometry=new THREE.LatheGeometry(tireProfile.map(([x,r])=>new THREE.Vector2(r*d.radius,x*d.tireWidth)),40);tireGeometry.rotateZ(-Math.PI/2);
    const tire=new THREE.Mesh(tireGeometry,materials.rubber);tire.name=`tire-${label}`;roll.add(tire);
    const rimRadius=d.radius*(pickup?.59:cobra?.61:.68),rimWidth=d.tireWidth*.87;
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(rimRadius,rimRadius,rimWidth,32),materials.trim);barrel.rotation.z=Math.PI/2;roll.add(barrel);
    const faceX=side*d.tireWidth*.49;
    const rim=new THREE.Mesh(new THREE.TorusGeometry(rimRadius,.010,6,32),materials.rims);rim.rotation.y=Math.PI/2;rim.position.x=faceX;roll.add(rim);
    const inner=new THREE.Mesh(new THREE.TorusGeometry(rimRadius*.83,.006,5,32),materials.rims);inner.rotation.y=Math.PI/2;inner.position.x=faceX-side*.006;roll.add(inner);
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(rimRadius*.78,rimRadius*.78,.012,28),materials.discs);disc.rotation.z=Math.PI/2;disc.position.x=faceX-side*.045;steer.add(disc);
    const caliper=new THREE.Mesh(new RoundedBoxGeometry(.027,.11,.055,2,.008),rally?materials.calipers:materials.trim);caliper.position.set(faceX-side*.038,.025,rimRadius*.55);steer.add(caliper);
    const spokeCount=pickup?8:rally?6:5;
    for(let k=0;k<spokeCount;k++){
      const angle=k/spokeCount*Math.PI*2,spoke=new THREE.Mesh(new RoundedBoxGeometry(.021,pickup?.038:.026,rimRadius*.76,1,.004),materials.rims);
      spoke.position.set(faceX-side*.009,Math.sin(angle)*rimRadius*.54,Math.cos(angle)*rimRadius*.54);spoke.rotation.x=-angle;roll.add(spoke);
    }
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(rimRadius*.24,rimRadius*.24,.027,16),materials.chrome);hub.rotation.z=Math.PI/2;hub.position.x=faceX;roll.add(hub);
    for(let k=0;k<5;k++){
      const a=k/5*Math.PI*2,bolt=new THREE.Mesh(new THREE.SphereGeometry(.007,6,4),materials.chrome);bolt.position.set(faceX+side*.017,Math.sin(a)*rimRadius*.32,Math.cos(a)*rimRadius*.32);roll.add(bolt);
    }
    // Shoulder grooves remain visible in a close showroom inspection.
    for(const sign of [-1,1]){
      const groove=new THREE.Mesh(new THREE.TorusGeometry(d.radius*.985,.003,4,40),materials.trim);groove.rotation.y=Math.PI/2;groove.position.x=sign*d.tireWidth*.27;roll.add(groove);
    }
    wheels.push(roll);if(front)frontWheels.push(steer);wheelSlots.push({roll,steer,tire,rim,side,radius:d.radius,width:d.tireWidth});
  }

  const seat=(x,z,baseY=.52)=>{
    box(x,baseY,z,.37,.10,.38,materials.interior,.045);
    const back=box(x,baseY+.19,z-.17,.37,.39,.085,materials.interior,.055);back.rotation.x=-.13;
    if(rally)box(x,baseY+.43,z-.19,.22,.13,.075,materials.interior,.035);
    for(const sx of [-1,1])box(x+sx*.16,baseY+.1,z,.05,.12,.33,materials.interior,.023);
  };
  const cockpit=(dashZ,dashY,seatZ)=>{
    box(0,dashY,dashZ,d.width*.73,.12,.14,materials.interior,.025);
    seat(-.30,seatZ,cobra?.44:.53);seat(.30,seatZ,cobra?.44:.53);
    box(0,cobra?.44:.53,seatZ+.02,.14,.14,.56,materials.interior,.025);
    beam([.035,cobra?.52:.62,seatZ+.08],[.035,cobra?.64:.76,seatZ+.10],.009,materials.chrome);
    ellipsoid(.035,cobra?.65:.77,seatZ+.10,.027,.027,.027,materials.trim);
    const steering=add(new THREE.TorusGeometry(.112,.012,6,28),materials.trim,-.30,dashY+.047,dashZ-.13,.24);
    for(let i=0;i<3;i++){
      const a=i/3*Math.PI*2;beam([-.30,dashY+.047,dashZ-.13],[-.30+Math.cos(a)*.10,dashY+.047+Math.sin(a)*.10,dashZ-.13],.006,materials.rims);
    }
    steering.name='steering-wheel';
    for(const x of [-.39,-.26]){
      const gauge=add(new THREE.CylinderGeometry(.036,.036,.008,16),materials.trim,x,dashY+.045,dashZ-.077,Math.PI/2);
      gauge.name='instrument';
    }
  };

  if(pickup){
    // Long horizontal beltline, upright single cab and genuinely hollow bed.
    const roofRear=-.47,roofFront=.35,sillRear=-.57,sillFront=.75;
    box(0,1.335,-.06,1.27,.07,.91,materials.paint,.05);
    pane([[-.60,1.301,.39],[.60,1.301,.39],[.66,.85,.76],[-.66,.85,.76]]);
    pane([[.60,1.298,-.49],[-.60,1.298,-.49],[-.65,.86,-.58],[.65,.86,-.58]]);
    for(const side of [-1,1]){
      pane([[side*.607,1.292,roofRear],[side*.607,1.292,roofFront],[side*.681,.866,sillFront],[side*.694,.866,sillRear]]);
      frame([[side*.70,.81,sillRear],[side*.61,1.31,roofRear],[side*.61,1.31,roofFront],[side*.68,.84,sillFront]],.022,materials.paint);
      beam([side*.66,1.28,.19],[side*.69,.86,.32],.012,materials.chrome);
      frame([[side*.703,.83,-.55],[side*.720,.31,-.53],[side*.724,.30,.58],[side*.715,.80,.72]],.005);
      box(side*.737,.78,-.33,.022,.027,.14,materials.chrome,.006);
      beam([side*.69,.98,.48],[side*.83,.99,.47],.012,materials.chrome);
      box(side*.85,1.015,.47,.065,.135,.16,materials.chrome,.016);
      box(side*.888,1.015,.47,.008,.105,.12,materials.glass,.008);
      box(side*.75,.58,-.99,.023,.022,1.18,materials.chrome,.006);
      box(side*.70,.60,-1.651,.14,.26,.028,materials.brakes,.018);
      box(side*.43,.65,1.661,.235,.205,.022,materials.trim,.016);
      box(side*.43,.65,1.678,.19,.16,.018,materials.headlights,.012);
      box(side*.58,.47,1.673,.14,.055,.022,materials.amber,.007);
    }
    box(0,.49,-1.02,1.21,.035,1.08,materials.interior,.016);
    box(0,.64,-.56,1.24,.28,.055,materials.paint,.02);
    for(const side of [-1,1])box(side*.61,.65,-1.05,.045,.29,1.11,materials.interior,.012);
    for(let i=-5;i<=5;i++)box(i*.095,.512,-1.04,.026,.014,1.00,materials.trim,.003);
    box(0,.69,-1.61,1.28,.20,.065,materials.paint,.016);
    box(0,.76,-1.65,.19,.03,.016,materials.chrome,.005);
    box(0,.38,-1.697,1.47,.10,.10,materials.chrome,.018);
    box(0,.39,1.70,1.45,.11,.10,materials.chrome,.018);
    box(0,.63,1.669,.56,.19,.024,materials.trim,.012);
    for(let j=0;j<4;j++)box(0,.56+j*.046,1.688,.54,.009,.018,materials.chrome,.002);
    tube([[-.55,.821,.80],[-.53,.852,1.20],[-.46,.776,1.58],[.46,.776,1.58],[.53,.852,1.20],[.55,.821,.80]],.004);
    cockpit(.58,.89,-.12);
    // Cab rear wall is below the back glass; the bed remains open above it.
    box(0,.77,-.52,1.30,.18,.055,materials.paint,.02);
  }else if(rally){
    // Four-door glasshouse: raked windscreen, distinct B/C pillars and roof crown.
    add(patch((u,v)=>{
      const x=lerp(-.605,.605,u),z=lerp(-.70,.31,v);return [x,1.171+.027*(1-(x/.605)**2)+.012*Math.sin(v*Math.PI),z];
    },16,16),materials.paint);
    pane([[-.589,1.162,.33],[.589,1.162,.33],[.686,.756,.91],[-.686,.756,.91]]);
    pane([[.591,1.159,-.72],[-.591,1.159,-.72],[-.686,.749,-1.19],[.686,.749,-1.19]]);
    for(const side of [-1,1]){
      pane([[side*.605,1.145,-.65],[side*.605,1.145,-.21],[side*.735,.754,-.21],[side*.713,.754,-1.03]]);
      pane([[side*.605,1.145,-.14],[side*.605,1.145,.29],[side*.704,.758,.79],[side*.735,.754,-.14]]);
      frame([[side*.702,.746,-1.16],[side*.605,1.175,-.72],[side*.605,1.183,.32],[side*.699,.753,.92]],.018,materials.paint);
      beam([side*.608,1.16,-.18],[side*.737,.75,-.18],.020,materials.trim);
      frame([[side*.722,.749,-1.02],[side*.750,.30,-.75],[side*.752,.29,-.18],[side*.750,.75,-.18]],.004);
      frame([[side*.750,.75,-.18],[side*.753,.29,-.18],[side*.752,.29,.61],[side*.744,.75,.79]],.004);
      for(const z of [-.66,.35])box(side*.764,.70,z,.018,.025,.115,materials.trim,.005);
      box(side*.775,.879,.56,.15,.074,.17,materials.paint,.023);
      box(side*.851,.88,.555,.008,.045,.12,materials.glass,.007);
      box(side*.762,.245,0,.09,.08,1.39,materials.paint,.012);
      box(side*.715,.41,1.78,.22,.14,.07,materials.trim,.016);
      box(side*.715,.41,1.818,.12,.075,.012,materials.headlights,.017);
      box(side*.588,.559,-1.874,.29,.165,.035,materials.brakes,.014);
      box(side*.588,.568,-1.896,.21,.043,.009,materials.headlights,.004);
      // Wing uprights meet the boot; wing spans the rear track.
      box(side*.52,.838,-1.47,.045,.26,.10,materials.trim,.009);
      box(side*.734,.995,-1.49,.025,.17,.35,materials.paint,.01);
      const lamp=[[-.78,.61,1.69],[-.35,.61,1.844],[-.35,.49,1.858],[-.74,.48,1.77]].map(([x,y,z])=>[side*Math.abs(x),y,z]);
      pane(lamp,materials.headlights);
      for(const x of [.45,.59,.70])ellipsoid(side*x,.548,1.816-(x-.35)*.22,.046,.042,.016,materials.chrome);
    }
    box(0,.98,-1.49,1.49,.055,.30,materials.paint,.018);
    box(0,.235,1.79,1.49,.045,.20,materials.trim,.012);
    box(0,.39,1.88,.88,.21,.025,materials.trim,.015);
    box(0,.40,1.899,.66,.12,.006,materials.discs,.004);
    for(let j=0;j<5;j++)box(0,.35+j*.026,1.906,.63,.006,.008,materials.chrome,.002);
    box(0,.62,1.84,.36,.065,.035,materials.trim,.008);
    box(0,.31,-1.87,1.41,.14,.08,materials.trim,.012);
    box(0,.47,-1.902,.36,.10,.009,materials.secondary,.007);
    for(const side of [-1,1]){
      tube([[side*.51,.745,.96],[side*.47,.726,1.35],[side*.37,.656,1.65]],.004);
      for(let j=0;j<4;j++)box(side*.25,.731,1.13+j*.069,.29,.009,.033,materials.trim,.004);
      beam([side*.68,.74,.83],[side*.20,.77,.87],.005,materials.trim);
    }
    box(0,.71,-.48,1.30,.06,1.18,materials.interior,.02);
    cockpit(.71,.79,-.04);
    // Exhaust tip, inset into a dark bumper aperture.
    add(new THREE.CylinderGeometry(.049,.049,.15,16),materials.chrome,-.49,.25,-1.89,Math.PI/2);
    add(new THREE.CylinderGeometry(.035,.035,.006,16),materials.trim,-.49,.25,-1.969,Math.PI/2);
  }else{
    // Rounded separate wings, open tub and full windscreen frame. No roof or
    // solid deck over the seats; the long bonnet is the main visual mass.
    box(0,.32,-.40,1.02,.05,1.08,materials.interior,.025);
    for(const side of [-1,1]){
      box(side*.505,.43,-.42,.045,.25,1.08,materials.interior,.018);
      tube([[side*.51,.606,.13],[side*.51,.574,-.32],[side*.55,.608,-.94]],.016,materials.chrome);
      tube([[side*.67,.59,.05],[side*.70,.33,-.02],[side*.70,.31,-.69],[side*.72,.59,-.81]],.004);
      box(side*.727,.56,-.51,.017,.022,.10,materials.chrome,.005);
      beam([side*.78,.22,-.70],[side*.78,.22,.45],.042,materials.chrome);
      beam([side*.78,.22,-.70],[side*.82,.22,-.91],.044,materials.chrome);
      for(let j=0;j<4;j++)beam([side*.68,.35,.25+j*.07],[side*.78,.22,.25+j*.065],.022,materials.chrome);
      // Lamps sit in rounded fender buckets, ahead of the axle.
      ellipsoid(side*.56,.563,1.43,.139,.143,.060,materials.chrome);
      ellipsoid(side*.56,.565,1.477,.115,.119,.029,materials.headlights);
      ellipsoid(side*.54,.384,1.595,.044,.029,.018,materials.amber);
      for(const y of [.43,.53])ellipsoid(side*.574,y,-1.642,.037,.037,.022,materials.brakes);
      box(side*.43,.32,1.735,.042,.17,.045,materials.chrome,.016);
      box(side*.40,.31,-1.748,.04,.16,.04,materials.chrome,.015);
      beam([side*.55,.62,.16],[side*.51,.965,.025],.014,materials.chrome);
      ellipsoid(side*.62,.77,.10,.07,.037,.042,materials.chrome);
      for(let j=0;j<3;j++)box(side*.728,.49,.40+j*.055,.014,.11,.022,materials.trim,.004);
    }
    pane([[-.548,.63,.166],[.548,.63,.166],[.509,.962,.025],[-.509,.962,.025]]);
    beam([-.509,.965,.025],[.509,.965,.025],.015,materials.chrome);
    beam([-.55,.625,.166],[.55,.625,.166],.014,materials.chrome);
    cockpit(.10,.62,-.46);
    // Driver roll hoop, with two legs ending at the rear deck.
    const hoop=[];for(let i=0;i<=20;i++){const a=i/20*Math.PI;hoop.push([-.28+Math.cos(a)*.19,.76+Math.sin(a)*.19,-.99]);}
    tube(hoop,.018,materials.chrome);beam([-.47,.62,-.99],[-.47,.76,-.99],.018,materials.chrome);beam([-.09,.62,-.99],[-.09,.76,-.99],.018,materials.chrome);
    beam([-.28,.91,-.99],[-.28,.62,-1.28],.014,materials.chrome);
    // Scoop follows the bonnet; the dark mouth faces forward.
    box(0,.688,.69,.30,.075,.44,materials.paint,.032);
    box(0,.693,.908,.228,.038,.009,materials.trim,.012);
    ellipsoid(0,.345,1.755,.364,.135,.014,materials.trim);
    const grille=add(new THREE.TorusGeometry(1,.022,6,40),materials.chrome,0,.345,1.765);grille.scale.set(.368,.139,1);
    for(const x of [-.23,-.115,0,.115,.23])beam([x,.26,1.77],[x,.43,1.77],.004,materials.discs);
    ellipsoid(.51,.661,-1.29,.058,.013,.058,materials.chrome);
    box(0,.36,-1.77,.30,.09,.012,materials.secondary,.007);
    // Narrow twin painted stripes follow the curved sheet metal without floating.
    for(const [from,to]of [[.16,1.735],[-1.735,-1.02]])for(const side of [-1,1]){
      add(patch((u,v)=>{const z=lerp(from,to,v),x=side*.125+lerp(-.052,.052,u);return [x,top(x,z)+.003,z];},2,60),materials.secondary);
    }
  }

  // Merge every static part by material; moving wheels retain their pivots.
  // Bake each material's vehicle-space UV projection after transform.
  const buckets=new Map();
  for(const mesh of parts){
    mesh.updateMatrix();let g=mesh.geometry.clone();if(g.index){const ng=g.toNonIndexed();g.dispose();g=ng;}g.applyMatrix4(mesh.matrix);
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
      if(ny>=nx&&ny>=nz)uv.setXY(i,p.getX(i)/d.width+.5,p.getZ(i)/d.length+.5);
      else if(nx>=nz)uv.setXY(i,p.getZ(i)/d.length+.5,p.getY(i)/d.roof);
      else uv.setXY(i,p.getX(i)/d.width+.5,p.getY(i)/d.roof);
    }
    const list=buckets.get(mesh.material)||[];list.push(g);buckets.set(mesh.material,list);mesh.geometry.dispose();
  }
  for(const [material,geometries]of buckets){
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error(`Cannot merge ${vehicle.id}/${material.name}`);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name;mesh.castShadow=!material.transparent;mesh.receiveShadow=true;bodyRig.add(mesh);
  }
  // Merge wheel hardware by material too: 12-car grids stay within a finite
  // draw-call budget without losing either brake or steering animation.
  for(const slot of wheelSlots)mergeChildren(slot.roll);
  for(const slot of wheelSlots)mergeChildren(slot.steer);
  for(const side of [-1,1])for(const type of ['trail-rear','exhaust']){
    const socket=new THREE.Object3D(),name=`${type}-${side<0?'left':'right'}`;socket.name=name;socket.userData.socket=type;
    socket.position.set(side*d.track/2,type==='trail-rear'?.025:.23,type==='trail-rear'?-d.wheelbase/2:-d.length/2);group.add(socket);sockets[name]=socket;
  }
  return {group,bodyRig,wheels,frontWheels,wheelSlots,materials,sockets,vehicle,wheelRadius:d.radius,brakeMaterials:[materials.brakes],brakeRearZ:-d.length/2-.025};
}

function mergeChildren(parent){
  const buckets=new Map();for(const mesh of [...parent.children]){
    if(!mesh.isMesh)continue;mesh.updateMatrix();let g=mesh.geometry.clone();if(g.index){const ng=g.toNonIndexed();g.dispose();g=ng;}g.applyMatrix4(mesh.matrix);
    const list=buckets.get(mesh.material)||[];list.push(g);buckets.set(mesh.material,list);mesh.geometry.dispose();mesh.removeFromParent();
  }
  for(const [material,geometries]of buckets){const g=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(g,material);mesh.name=material.name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}
}

import * as THREE from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const mix=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp,UP=new THREE.Vector3(0,1,0);
export function sampleCurve(points,z,k=1){
  let i=1;while(i<points.length-1&&z>points[i][0])i++;
  const a=points[i-1],b=points[i],p=points[Math.max(0,i-2)],n=points[Math.min(points.length-1,i+1)],dz=b[0]-a[0],t=clamp((z-a[0])/dz,0,1);
  const ma=(b[k]-p[k])/(b[0]-p[0]),mb=(n[k]-a[k])/(n[0]-a[0]);
  return (2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*dz*ma+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*dz*mb;
}
export function surface(fn,nu=16,nv=32){
  const p=[],uv=[],idx=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1;idx.push(a,c,b,b,c,c+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const standard=(name,color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
export class AutomotiveBody {
  constructor(vehicle,design){
    this.vehicle=vehicle;this.d=design;this.group=new THREE.Group();this.group.name=vehicle.id;
    this.bodyRig=new THREE.Group();this.bodyRig.name='sprung-body';this.group.add(this.bodyRig);this.parts=[];
    this.wheels=[];this.frontWheels=[];this.wheelSlots=[];this.sockets={};
    this.group.userData={vehicleId:vehicle.id,modelVersion:3,axes:'+Y up, +Z forward',wheelRadius:design.radius,wheelbase:design.wheelbase,track:design.track,inspiration:design.inspiration};
    this.materials={
      paint:new THREE.MeshPhysicalMaterial({name:'exterior-paint',color:vehicle.color,metalness:.12,roughness:.23,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.1}),
      secondary:standard('secondary-paint','#e0e3e4',.26,.1),glass:new THREE.MeshPhysicalMaterial({name:'windows',color:'#101920',metalness:.15,roughness:.095,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.3,side:THREE.DoubleSide}),
      trim:standard('black-trim','#14181d',.42),rubber:standard('rubber','#141517',.88),rims:standard('rims',design.chromeWheels?'#a9aeb4':'#48515b',.24,.82),
      chrome:standard('chrome','#cbd0d5',.17,1),interior:standard('interior','#202328',.94),discs:standard('brake-discs','#858a8e',.42,.87),
      headlights:standard('headlights','#a5b6c1',.12,.45),leds:standard('daytime-lights','#e5edf2',.24),brakes:standard('taillights','#830509',.23,.05),calipers:standard('brake-calipers','#ae1917',.46,.2),
      amber:standard('indicators','#b5530b',.3,.05),grille:standard('grille-mesh','#292e31',.65,.25),
    };
    this.materials.leds.emissive.set('#b8ddff');this.materials.leds.emissiveIntensity=.45;
    this.materials.brakes.emissive.set('#ff0801');this.materials.brakes.emissiveIntensity=0;
    for(const m of Object.values(this.materials))m.userData.vehicleMaterial=true;
  }
  width(z){return sampleCurve(this.d.stations,z,1);}
  deck(z){return sampleCurve(this.d.stations,z,2);}
  roof(z){return this.d.roof?sampleCurve(this.d.roof,z):this.deck(z);}
  wing(z){return (this.d.fender??.08)*Math.max(...[-this.d.wheelbase/2,this.d.wheelbase/2].map(a=>Math.exp(-(((z-a)/.43)**2))));}
  upper(x,z){
    const t=Math.min(1,Math.abs(x)/this.width(z)),deck=this.deck(z),roof=this.roof(z),wing=this.wing(z);
    const cross=[[0,roof],[.42,roof-.005],[.65,roof-.012],[.71,roof-.025],[.80,mix(roof,deck,.58)+wing*.25],[.90,deck+wing],[.97,deck+wing-.015],[1,deck+wing-.040]];
    return sampleCurve(cross,t);
  }
  side(y,z,offset=0){
    const top=this.upper(this.width(z),z),f=clamp((top-y)/Math.max(.1,top-this.d.sill),0,1);
    // Sculpted door section: beltline, concave waist, substantial lower sill.
    return this.width(z)*(1-.035*Math.sin(f*Math.PI)-.012*f)+offset;
  }
  add(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);this.parts.push(o);return o;}
  box(x,y,z,w,h,l,m=this.materials.paint,r=.012){return this.add(new RoundedBoxGeometry(w,h,l,1,Math.max(.001,Math.min(r,w*.4,h*.4,l*.4))),m,x,y,z);}
  sphere(x,y,z,rx,ry,rz,m){const o=this.add(new THREE.SphereGeometry(1,24,12),m,x,y,z);o.scale.set(rx,ry,rz);return o;}
  beam(a,b,r=.005,m=this.materials.trim){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);const o=this.add(new THREE.CylinderGeometry(r,r,v.length(),8),m);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(UP,v.normalize());return o;}
  line(points,r=.003,m=this.materials.trim,smooth=true){
    if(!smooth){for(let i=1;i<points.length;i++)this.beam(points[i-1],points[i],r,m);return;}
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    // Dense control samples describe the shape; arc length sets render density.
    this.add(new THREE.TubeGeometry(curve,Math.max(12,Math.min(48,Math.ceil(curve.getLength()*20))),r,5,false),m);
  }
  // A shaped inset on an arbitrary mounting surface, with a recessed backing.
  polygon(points,m,depth=.008){
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    return this.add(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:8}),m);
  }
  fascia(points,z,m,depth=.008){const mesh=this.polygon(points,m,depth);mesh.position.z=z;return mesh;}
  topInset(points,m,lift=.005){
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
    let g=new THREE.ShapeGeometry(shape);const idx=g.index;
    for(let i=0;i<idx.count;i+=3){const b=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,b);}
    const refined=new TessellateModifier(.055,6).modify(g);g.dispose();g=refined;
    const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,this.upper(x,z)+lift,z);}
    g.computeVertexNormals();return this.add(g,m);
  }

  sideInset(side,points,m,lift=.007){
    const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
    const source=new THREE.ShapeGeometry(shape),g=new TessellateModifier(.055,6).modify(source),p=g.attributes.position;source.dispose();
    for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i);p.setXYZ(i,side*this.side(y,z,lift),y,z);}
    if(side>0){for(const attr of Object.values(g.attributes))for(let i=0;i<attr.count;i+=3)for(let k=0;k<attr.itemSize;k++){const a=attr.array[(i+1)*attr.itemSize+k];attr.array[(i+1)*attr.itemSize+k]=attr.array[(i+2)*attr.itemSize+k];attr.array[(i+2)*attr.itemSize+k]=a;}}
    g.computeVertexNormals();return this.add(g,m);
  }
  topPanel(z0,z1,halfWidth,m,lift=.004){
    return this.add(surface((u,v)=>{const z=mix(z0,z1,v),w=typeof halfWidth==='function'?halfWidth(v,z):halfWidth,x=mix(-w,w,u);return [x,this.upper(x,z)+lift,z];},20,24),m);
  }
  upperGlass(z0,z1,w0,w1){
    const frame=(pad,m,lift)=>this.add(surface((u,v)=>{
      const z=mix(z0+pad,z1-pad,v),w=mix(w0,w1,v)*this.width(z)-pad,x=mix(-w,w,u);
      return [x,this.upper(x,z)+lift,z];
    },20,24),m);
    frame(0,this.materials.trim,.005);frame(.016,this.materials.glass,.009);
  }
  sideWindow(side,points){
    // Points are [z, normalized half-width]. They conform to the exact body,
    // eliminating the floating glasshouse and separate tubular pillars.
    const make=(inset,m,lift)=>this.add(surface((u,v)=>{
      const q=points[0].map((n,k)=>mix(mix(n,points[1][k],u),mix(points[3][k],points[2][k],u),v));
      const z=q[0],x=side*this.width(z)*q[1];return [x+side*lift,this.upper(x,z)+lift*.35,z];
    },18,12),m);
    make(0,this.materials.trim,.005);
    const center=points.reduce((a,p)=>a.map((n,i)=>n+p[i]/4),[0,0]);
    const glass=points.map(p=>p.map((n,i)=>mix(n,center[i],.045)));
    const original=points;points=glass;make(0,this.materials.glass,.010);points=original;
  }
  shell(){
    const d=this.d,L=d.length/2;
    const spans=d.open?[[ -L,d.cockpit[0]],[d.cockpit[1],L]]:d.pickup?[[-L,d.bedEnd],[d.bedFront,L]]:[[-L,L]];
    for(const [a,b]of spans)this.add(surface((u,v)=>{const z=mix(a,b,v),x=this.width(z)*mix(-1,1,u);return [x,this.upper(x,z),z];},32,Math.ceil((b-a)*20)),this.materials.paint);
    if(d.open||d.pickup){const [a,b]=d.open?d.cockpit:[d.bedEnd,d.bedFront],inside=d.open?.72:.83;
      for(const side of [-1,1])this.add(surface((u,v)=>{const z=mix(a,b,v),x=side*this.width(z)*mix(inside,1,u);return [x,this.upper(x,z),z];},8,48),this.materials.paint);
    }
    const arch=d.radius+.036;
    for(const side of [-1,1]){
      const lower=z=>{let y=d.sill;for(const axle of [-d.wheelbase/2,d.wheelbase/2]){const dz=z-axle;if(Math.abs(dz)<arch)y=Math.max(y,d.radius+Math.sqrt(arch*arch-dz*dz));}return y;};
      this.add(surface((u,v)=>{
        const z=mix(-L,L,side<0?1-v:v),top=this.upper(this.width(z),z),bottom=lower(z),y=mix(top,Math.min(top-.006,bottom),u);
        return [side*this.side(y,z),y,z];
      },8,112),this.materials.paint);
      for(const axle of [-d.wheelbase/2,d.wheelbase/2]){
        const edge=[];for(let j=0;j<=30;j++){const a=j/30*Math.PI,z=axle+Math.cos(a)*arch,y=d.radius+Math.sin(a)*arch;edge.push([side*(this.side(y,z)+.002),y,z]);}
        this.line(edge,.007,this.materials.paint);this.line(edge.map(([x,y,z])=>[x-side*.013,y-.006,z]),.012,this.materials.trim);
      }
      this.box(side*(d.width/2-.03),d.sill+.02,0,.065,.06,d.wheelbase-arch*2,this.materials.trim,.012);
    }
    for(const side of [-1,1]){
      const z=side*L,w=this.width(z),top=this.upper(0,z);
      this.add(surface((u,v)=>{const x=mix(-w,w,side>0?1-u:u);return [x,mix(d.sill,this.upper(x,z),v),z];},28,12),this.materials.paint);
    }
    this.box(0,d.sill+.01,0,d.track-.35,.04,d.length*.86,this.materials.trim,.012);
  }
  runningGear(){
    const d=this.d,m=this.materials;
    for(const side of [-1,1])for(const front of [false,true]){
      const steer=new THREE.Group(),roll=new THREE.Group(),label=`${front?'front':'rear'}-${side<0?'left':'right'}`;
      steer.name=`steer-${label}`;roll.name=`wheel-${label}`;steer.position.set(side*d.track/2,d.radius,(front?1:-1)*d.wheelbase/2);steer.userData={side,front};steer.add(roll);this.group.add(steer);
      const profile=[[-.50,.74],[-.51,.84],[-.47,.91],[-.34,.985],[-.23,1],[.23,1],[.34,.985],[.47,.91],[.51,.84],[.50,.74]];
      const tg=new THREE.LatheGeometry(profile.map(([x,r])=>new THREE.Vector2(r*d.radius,x*d.tireWidth)),48);tg.rotateZ(-Math.PI/2);
      const tire=new THREE.Mesh(tg,m.rubber);tire.name=`tire-${label}`;roll.add(tire);
      const r=d.radius*(d.pickup?.60:d.open?.61:.72),faceX=side*d.tireWidth*.49;
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.tireWidth*.92,40),m.trim);barrel.rotation.z=Math.PI/2;roll.add(barrel);
      const disc=new THREE.Mesh(new THREE.CylinderGeometry(r*.84,r*.84,.014,36),m.discs);disc.rotation.z=Math.PI/2;disc.position.x=faceX-side*.040;steer.add(disc);
      const caliper=new THREE.Mesh(new RoundedBoxGeometry(.03,.105,.047,1,.008),m.calipers);caliper.position.set(faceX-side*.035,.02,r*.65);steer.add(caliper);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.007,5,48),m.rims);ring.rotation.y=Math.PI/2;ring.position.x=faceX;roll.add(ring);
      const rim=new THREE.Group();roll.add(rim);const spokeCount=d.pickup?6:5;
      for(let k=0;k<spokeCount;k++)for(const split of d.splitSpokes?[-1,1]:[0]){
        const a=k/spokeCount*Math.PI*2+split*.075;
        const spoke=new THREE.Mesh(new RoundedBoxGeometry(.020,.022,r*.77,1,.005),m.rims);spoke.rotation.x=-a;spoke.position.set(faceX-side*.007,Math.sin(a)*r*.53,Math.cos(a)*r*.53);rim.add(spoke);
      }
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.24,r*.24,.024,20),m.rims);hub.rotation.z=Math.PI/2;hub.position.x=faceX;roll.add(hub);
      for(let j=0;j<5;j++){const a=j/5*Math.PI*2,bolt=new THREE.Mesh(new THREE.SphereGeometry(.006,6,4),m.chrome);bolt.position.set(faceX+side*.014,Math.sin(a)*r*.30,Math.cos(a)*r*.30);roll.add(bolt);}
      for(const x of [-.26,.26]){const groove=new THREE.Mesh(new THREE.TorusGeometry(d.radius*.993,.002,4,48),m.trim);groove.rotation.y=Math.PI/2;groove.position.x=x*d.tireWidth;roll.add(groove);}
      this.wheels.push(roll);if(front)this.frontWheels.push(steer);this.wheelSlots.push({roll,steer,tire,rim,side,radius:d.radius,width:d.tireWidth});
    }
  }
  finish(){
    for(const part of this.parts){part.updateMatrix();this.bodyRig.add(part);}
    mergeParts(this.bodyRig);
    for(const slot of this.wheelSlots){
      for(const spoke of [...slot.rim.children])slot.roll.attach(spoke);
      mergeParts(slot.roll);mergeParts(slot.steer);
    }
    for(const side of [-1,1])for(const type of ['trail-rear','exhaust']){
      const node=new THREE.Object3D(),name=`${type}-${side<0?'left':'right'}`;node.name=name;node.userData.socket=type;node.position.set(side*this.d.track/2,type==='trail-rear'?.025:.22,type==='trail-rear'?-this.d.wheelbase/2:-this.d.length/2);this.group.add(node);this.sockets[name]=node;
    }
    return {group:this.group,bodyRig:this.bodyRig,wheels:this.wheels,frontWheels:this.frontWheels,wheelSlots:this.wheelSlots,materials:this.materials,sockets:this.sockets,vehicle:this.vehicle,wheelRadius:this.d.radius,brakeMaterials:[this.materials.brakes],brakeRearZ:-this.d.length/2-.025};
  }
}
function mergeParts(parent){
  const buckets=new Map();for(const o of [...parent.children]){
    if(!o.isMesh)continue;o.updateMatrix();let g=o.geometry.clone();if(g.index){const h=g.toNonIndexed();g.dispose();g=h;}g.applyMatrix4(o.matrix);
    const list=buckets.get(o.material)||[];list.push(g);buckets.set(o.material,list);o.geometry.dispose();o.removeFromParent();
  }
  for(const [m,gs]of buckets){const g=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());const o=new THREE.Mesh(g,m);o.name=m.name;o.castShadow=true;o.receiveShadow=true;parent.add(o);}
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCollectionVehicle } from './vehicle-modeler.js';
import { loadCustomization, prepareVehicleWrap } from './vehicle-customization.js';

let truckTemplate, loading;

export async function preloadVehicles(loadTruck = () => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/vehicle-truck-yellow.glb`)) {
  loading ||= loadTruck().then(gltf => { truckTemplate = gltf.scene; });
  return loading;
}

function originalTruck() {
  if (!truckTemplate) throw new Error('El truck original aún se está cargando.');
  const group = truckTemplate.clone(true), wheels = [], frontWheels = [];
  group.scale.setScalar(1.05);
  group.traverse(node => {
    if (node.isMesh) {
      node.geometry = node.geometry.clone();
      node.material = node.material.clone();
      node.castShadow = false; node.receiveShadow = true;
    }
    if (node.name.includes('wheel')) { wheels.push(node); if (node.name.includes('front')) frontWheels.push(node); }
  });
  const brakeMaterial=makeBrakeMaterial();
  for(const side of [-1,1]){
    const lens=new THREE.Mesh(new RoundedBoxGeometry(.2,.2,.055,2,.025),brakeMaterial);
    lens.name=side<0?'brake-lamp-right':'brake-lamp-left';lens.position.set(side*.61,.69,-1.414);group.add(lens);
  }
  return { group, wheels, frontWheels, brakeMaterials:[brakeMaterial], brakeRearZ:-1.48 };
}

function material(name, color, roughness = .45, metalness = 0) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  mat.name = name;
  return mat;
}

function makeBrakeMaterial() {
  const lens=material('taillights','#8c211a',.26,.05);
  lens.emissive.set('#ff0802');lens.emissiveIntensity=0;
  return lens;
}

export function setBrakeLights(materials, amount) {
  const intensity=Math.max(0,Math.min(1,amount))*2.6;
  for(const lens of materials||[])lens.emissiveIntensity=intensity;
}

function bodyLoft(sections) {
  const positions = [], indices = [];
  for (const [z,w,low,shoulder,top] of sections) {
    for (const [x,y] of [[w*.82,low],[w,low+.09],[w,shoulder],[w*.55,top],[-w*.55,top],[-w,shoulder],[-w,low+.09],[-w*.82,low]]) positions.push(x,y,z);
  }
  for (let i=0;i<sections.length-1;i++) for(let j=0;j<8;j++) {
    const a=i*8+j,b=i*8+(j+1)%8,c=(i+1)*8+j,d=(i+1)*8+(j+1)%8;
    indices.push(a,b,c,b,d,c);
  }
  for(let j=1;j<7;j++){indices.push(0,j+1,j);const n=(sections.length-1)*8;indices.push(n,n+j,n+j+1);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function quad(points) {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();return g;
}

/** Sculpted miniature bodies with named material parts, shared by race and garage. */
export function buildVehicle(vehicle) {
  if (vehicle.design) {
    const model=buildCollectionVehicle(vehicle,loadCustomization(vehicle));
    prepareVehicleWrap(model);
    return model;
  }
  if (vehicle.id==='coda') return originalTruck();
  const cobra=vehicle.id==='velo', group=new THREE.Group(), wheels=[], frontWheels=[], parts=[];
  const paint=material('exterior-paint',vehicle.color,.3,.18), rubber=material('rubber','#20272c',.95);
  const dark=material('interior','#242e33',.8), trim=material('black-trim','#202a30',.5), chrome=material('chrome','#bfcbd0',.24,.7);
  const glass=material('windows','#4e717e',.18,.18);glass.side=THREE.DoubleSide;
  const white=material('racing-stripes','#f5f1df',.35), lamp=material('headlights','#fff1c6',.22,.1), tail=makeBrakeMaterial();
  lamp.side=THREE.DoubleSide;
  lamp.emissive.set('#c8b895');lamp.emissiveIntensity=.12;
  const add=(geometry,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);parts.push(mesh);return mesh;
  };
  const box=(x,y,z,w,h,l,mat,r=.04)=>add(new RoundedBoxGeometry(w,h,l,2,Math.max(.001,Math.min(r,w*.4,h*.4,l*.4))),mat,x,y,z);
  const beam=(a,b,r,mat)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
    const mesh=add(new THREE.CylinderGeometry(r,r,direction.length(),8),mat);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
  };
  const wheelbase=cobra?1.02:1.01, wheelX=cobra?.88:.87;
  const sections=cobra?[
    [-1.62,.58,.29,.48,.61],[-1.35,.83,.26,.61,.72],[-1.03,.94,.25,.62,.75],[-.65,.82,.27,.56,.65],[-.16,.77,.28,.54,.64],
    [.35,.85,.26,.59,.72],[.84,.94,.25,.61,.75],[1.22,.84,.29,.54,.67],[1.55,.59,.34,.45,.54],[1.65,.48,.36,.43,.5],
  ]:[
    [-1.62,.69,.32,.59,.68],[-1.43,.85,.27,.67,.78],[-.98,.91,.27,.71,.81],[-.3,.88,.28,.71,.81],
    [.5,.89,.28,.7,.82],[1.08,.91,.27,.66,.81],[1.48,.81,.31,.61,.72],[1.63,.73,.34,.57,.67],
  ];
  add(bodyLoft(sections),paint);
  box(0,.27,0,1.5,.15,2.85,trim,.07);
  for(const side of [-1,1])for(const front of [false,true]){
    const z=front?wheelbase:-wheelbase;
    add(new THREE.TorusGeometry(.365,.055,5,18,Math.PI),paint,side*.902,.325,z,0,Math.PI/2);
    const steer=new THREE.Group();steer.position.set(side*wheelX,.32,z);
    const roll=new THREE.Group();steer.add(roll);group.add(steer);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.27,20),rubber);tire.rotation.z=Math.PI/2;
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.205,.205,.282,16),trim);hub.rotation.z=Math.PI/2;
    const center=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.318,10),chrome);center.rotation.z=Math.PI/2;
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.193,.021,5,20),chrome);rim.rotation.y=Math.PI/2;rim.position.x=side*.151;
    roll.add(tire,hub,center,rim);
    for(let i=0;i<5;i++){
      const spoke=new THREE.Mesh(new THREE.BoxGeometry(.025,.035,.34),chrome);spoke.position.x=side*.152;spoke.rotation.x=i/5*Math.PI;roll.add(spoke);
    }
    wheels.push(roll);if(front)frontWheels.push(steer);
  }
  if(!cobra){
    // Four-door rally sedan: sloping glasshouse, vented bonnet and tall rear wing.
    box(0,1.245,-.19,1.31,.12,1.13,paint,.065);
    add(quad([[-.64,1.235,.35],[.64,1.235,.35],[.79,.835,.83],[-.79,.835,.83]]),glass);
    add(quad([[.65,1.21,-.76],[-.65,1.21,-.76],[-.8,.825,-1.14],[.8,.825,-1.14]]),glass);
    for(const side of [-1,1]){
      const x=side;
      add(quad([[x*.645,1.19,-.72],[x*.645,1.19,-.25],[x*.805,.83,-.25],[x*.805,.83,-1.05]]),glass);
      add(quad([[x*.645,1.2,-.17],[x*.645,1.2,.3],[x*.8,.83,.71],[x*.8,.83,-.17]]),glass);
      beam([x*.65,1.21,-.21],[x*.81,.81,-.21],.033,paint);
      beam([x*.65,1.21,-.77],[x*.81,.82,-1.12],.032,paint);
      beam([x*.65,1.23,.35],[x*.81,.82,.83],.033,paint);
      box(x*.91,.69,-.2,.025,.035,1.27,trim,.008);
      box(x*.91,.78,-.53,.035,.035,.17,chrome,.01);box(x*.91,.78,.31,.035,.035,.17,chrome,.01);
      box(x*.91,.99,.48,.19,.1,.19,paint,.04);
      box(x*.86,.32,0,.13,.11,1.35,paint,.03);
      box(x*.63,.995,-1.38,.085,.42,.11,trim,.02);
      box(x*.61,.67,-1.625,.41,.15,.045,tail,.025);
      add(quad([[x*.36,.735,1.58],[x*.79,.7,1.48],[x*.76,.57,1.58],[x*.4,.58,1.63]]),lamp);
    }
    box(0,1.21,-1.39,1.92,.11,.34,paint,.045);
    add(quad([[-.37,.65,1.639],[.37,.65,1.639],[.51,.35,1.644],[-.51,.35,1.644]]),trim);
    box(0,.295,1.57,1.7,.07,.25,trim,.035);
    box(0,.43,-1.65,.45,.14,.025,white,.008);
    for(const x of [-.25,.25])for(let i=0;i<3;i++)box(x,.83,1.04+i*.085,.25,.016,.033,trim,.006);
    box(0,.75,1.646,.25,.018,.015,chrome,.004);
    box(0,.38,-1.58,1.68,.12,.16,trim,.03);
  }else{
    // Cobra-inspired roadster: long curved bonnet, open twin cockpit, side pipes.
    box(0,.685,-.43,1.25,.08,1.15,dark,.15);
    for(const side of [-1,1]){
      box(side*.32,.75,-.49,.46,.14,.48,dark,.065);
      const seat=box(side*.32,.925,-.78,.46,.4,.15,dark,.075);seat.rotation.x=-.13;
      beam([side*.61,.76,.24],[side*.56,1.1,.07],.024,chrome);
      beam([side*.99,.27,-.79],[side*.99,.27,.55],.075,chrome);
      add(new THREE.CylinderGeometry(.085,.085,.14,12),trim,side*.99,.27,-.83,Math.PI/2);
      add(new THREE.TorusGeometry(.15,.028,6,20),chrome,side*.63,.65,1.37);
      const head=add(new THREE.SphereGeometry(.132,12,8),lamp,side*.63,.65,1.385);head.scale.z=.45;
      box(side*.51,.37,1.65,.055,.25,.06,chrome,.025);
      add(new THREE.SphereGeometry(.075,10,7),tail,side*.64,.56,-1.59);
    }
    const wind=material('windscreen','#bedcde',.12,.12);wind.transparent=true;wind.opacity=.32;wind.side=THREE.DoubleSide;wind.depthWrite=false;wind.forceSinglePass=true;
    add(quad([[-.61,.77,.24],[.61,.77,.24],[.56,1.1,.07],[-.56,1.1,.07]]),wind);
    beam([-.56,1.1,.07],[.56,1.1,.07],.024,chrome);beam([-.61,.77,.24],[.61,.77,.24],.022,chrome);
    box(0,.8,.13,1.15,.14,.17,dark,.05);
    add(new THREE.TorusGeometry(.14,.018,6,18),chrome,-.32,.9,-.025,.15);
    add(new THREE.TorusGeometry(.205,.026,6,18,Math.PI),chrome,-.32,.95,-.99);
    for(const x of [-.525,-.115])beam([x,.73,-.99],[x,.95,-.99],.026,chrome);
    box(0,.8,.76,.35,.13,.52,paint,.065);box(0,.82,1.024,.23,.06,.018,trim,.018);
    const topAt=z=>{
      for(let i=1;i<sections.length;i++)if(z<=sections[i][0]){const a=sections[i-1],b=sections[i];return a[4]+(b[4]-a[4])*(z-a[0])/(b[0]-a[0]);}
      return sections.at(-1)[4];
    };
    for(const [from,to] of [[.28,1.64],[-1.61,-1.04]])for(const side of [-1,1]){
      const x=side*.145;
      for(let z=from;z<to-.001;z+=.08){const end=Math.min(to,z+.08);add(quad([[x-.065,topAt(z)+.009,z],[x+.065,topAt(z)+.009,z],[x+.065,topAt(end)+.009,end],[x-.065,topAt(end)+.009,end]]),white);}
    }
    box(0,.45,1.647,.86,.26,.045,trim,.12);
    const rim=add(new THREE.TorusGeometry(1,.045,6,28),chrome,0,.45,1.674);rim.scale.set(.465,.155,.5);
    box(0,.445,-1.641,.37,.12,.025,chrome,.025);
  }
  // Merge stationary parts by material to keep three showroom cars inexpensive.
  const buckets=new Map();
  for(const mesh of parts){mesh.updateMatrix();let g=mesh.geometry.clone();if(g.index){const nonIndexed=g.toNonIndexed();g.dispose();g=nonIndexed;}g.applyMatrix4(mesh.matrix);const list=buckets.get(mesh.material)||[];list.push(g);buckets.set(mesh.material,list);mesh.geometry.dispose();}
  for(const [mat,geometries]of buckets){const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)throw new Error('No se ha podido montar la carrocería');const mesh=new THREE.Mesh(merged,mat);mesh.name=mat.name;mesh.receiveShadow=true;group.add(mesh);}
  return { group, wheels, frontWheels, brakeMaterials:[tail], brakeRearZ:cobra?-1.65:-1.67 };
}

// Small navigational badges; the selectable garage itself always uses real 3D models.
export function carIllustration(vehicle) {
  const truck=vehicle.id==='coda'||vehicle.design?.features.includes('pickup'),cobra=vehicle.id==='velo'||vehicle.design?.features.includes('open');
  const silhouette=truck?'M8 22H39V11H65L77 23H99V33H8Z':cobra?'M8 27Q10 18 29 21L43 23L50 16H54L57 22Q84 13 100 26V33H8Z':'M8 24L25 21L36 10H67L80 21L100 24V33H8Z';
  return `<svg class="car-illustration" viewBox="0 0 108 44" fill="none" aria-hidden="true"><ellipse cx="54" cy="37" rx="47" ry="4" fill="#102321" opacity=".3"/><path d="${silhouette}" fill="${vehicle.color}"/>${truck?'<path d="M45 14H63L70 23H45Z" fill="#42616a"/>':cobra?'<path d="M32 21H49V26H32Z" fill="#273b40"/>':'<path d="M39 13H51V20H31L39 13ZM55 13H66L74 20H55Z" fill="#42616a"/>'}<circle cx="27" cy="32" r="9" fill="#263237"/><circle cx="81" cy="32" r="9" fill="#263237"/><circle cx="27" cy="32" r="4" fill="#d5dadd"/><circle cx="81" cy="32" r="4" fill="#d5dadd"/></svg>`;
}
